import { BorderedLoader, DynamicBorder, keyHint } from "@cavepi/pi-coding-agent";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, Theme } from "@cavepi/pi-coding-agent";
import {
	allocateImageId,
	Container,
	deleteKittyImage,
	getCapabilities,
	Image,
	matchesKey,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
	type TUI,
} from "@cavepi/pi-tui";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import {
	hasMarkdownAnnotationMarkers,
	isAnnotationWordChar,
	normalizeAnnotationText,
	prepareMarkdownForPandocPreview,
	readAnnotationProtectedTokenAt,
	replaceInlineAnnotationMarkers,
	transformMarkdownOutsideFences,
} from "./shared/annotation-scanner.js";

const CACHE_DIR = join(homedir(), ".pi", "cache", "markdown-preview");
const MERMAID_PDF_CACHE_DIR = join(CACHE_DIR, "mermaid-pdf");
const PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX = "PIMDPREVIEWANNOT";
const ANNOTATION_HELPERS_SOURCE = readFileSync(new URL("./client/annotation-helpers.js", import.meta.url), "utf-8");
const RENDER_VERSION = "v21";
const VIEWPORT_WIDTH_PX = 1200;
const PAGE_HEIGHT_PX = 2200;
const MAX_RENDER_HEIGHT_PX = 66000; // PAGE_HEIGHT_PX * 30

type ThemeMode = "dark" | "light";
type PreviewTarget = "terminal" | "browser" | "pdf";

interface PreviewPalette {
	bg: string;
	card: string;
	border: string;
	text: string;
	muted: string;
	codeBg: string;
	link: string;
	syntaxComment: string;
	syntaxKeyword: string;
	syntaxFunction: string;
	syntaxVariable: string;
	syntaxString: string;
	syntaxNumber: string;
	syntaxType: string;
	syntaxOperator: string;
	syntaxPunctuation: string;
}

interface PreviewStyle {
	themeMode: ThemeMode;
	palette: PreviewPalette;
	cacheKey: string;
}

interface PreviewPage {
	base64Png: string;
	truncatedHeight: boolean;
	index: number;
	total: number;
}

interface RenderPreviewResult {
	pages: PreviewPage[];
	themeMode: ThemeMode;
	truncatedPages: boolean;
}

interface CachedPage {
	buffer: Buffer;
	truncatedHeight: boolean;
	pageCount?: number;
}

interface RenderWithLoaderResult {
	preview: RenderPreviewResult;
	supportsCustomUi: boolean;
}

interface PreviewAnnotationPlaceholder {
	token: string;
	text: string;
	title: string;
}

const DARK_PREVIEW_PALETTE: PreviewPalette = {
	bg: "#0f1117",
	card: "#171b24",
	border: "#2b3343",
	text: "#e6edf3",
	muted: "#9da7b5",
	codeBg: "#13171e",
	link: "#58a6ff",
	syntaxComment: "#6A9955",
	syntaxKeyword: "#569CD6",
	syntaxFunction: "#DCDCAA",
	syntaxVariable: "#9CDCFE",
	syntaxString: "#CE9178",
	syntaxNumber: "#B5CEA8",
	syntaxType: "#4EC9B0",
	syntaxOperator: "#D4D4D4",
	syntaxPunctuation: "#D4D4D4",
};

const LIGHT_PREVIEW_PALETTE: PreviewPalette = {
	bg: "#f5f7fb",
	card: "#ffffff",
	border: "#d0d7de",
	text: "#1f2328",
	muted: "#57606a",
	codeBg: "#f7f7f7",
	link: "#0969da",
	syntaxComment: "#008000",
	syntaxKeyword: "#0000FF",
	syntaxFunction: "#795E26",
	syntaxVariable: "#001080",
	syntaxString: "#A31515",
	syntaxNumber: "#098658",
	syntaxType: "#267F99",
	syntaxOperator: "#000000",
	syntaxPunctuation: "#000000",
};

function getThemeMode(theme?: Theme): ThemeMode {
	const name = (theme?.name ?? "").toLowerCase();
	return name.includes("light") ? "light" : "dark";
}

function toHexByte(value: number): string {
	const clamped = Math.max(0, Math.min(255, Math.round(value)));
	return clamped.toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
	const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return undefined;
	return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

function adjustCodeBg(cardHex: string, themeMode: ThemeMode): string {
	const rgb = hexToRgb(cardHex);
	if (!rgb) return cardHex;
	if (themeMode === "dark") {
		// Slightly darker than card
		const f = 0.85;
		return rgbToHex(Math.round(rgb.r * f), Math.round(rgb.g * f), Math.round(rgb.b * f));
	}
	// Light: slightly darker than card (towards gray)
	const f = 0.97;
	return rgbToHex(Math.round(rgb.r * f), Math.round(rgb.g * f), Math.round(rgb.b * f));
}

function xterm256ToHex(index: number): string {
	const basic16 = [
		"#000000",
		"#800000",
		"#008000",
		"#808000",
		"#000080",
		"#800080",
		"#008080",
		"#c0c0c0",
		"#808080",
		"#ff0000",
		"#00ff00",
		"#ffff00",
		"#0000ff",
		"#ff00ff",
		"#00ffff",
		"#ffffff",
	];

	if (index >= 0 && index < basic16.length) {
		return basic16[index]!;
	}

	if (index >= 16 && index <= 231) {
		const i = index - 16;
		const r = Math.floor(i / 36);
		const g = Math.floor((i % 36) / 6);
		const b = i % 6;
		const values = [0, 95, 135, 175, 215, 255];
		return rgbToHex(values[r]!, values[g]!, values[b]!);
	}

	if (index >= 232 && index <= 255) {
		const gray = 8 + (index - 232) * 10;
		return rgbToHex(gray, gray, gray);
	}

	return "#000000";
}

function ansiColorToCss(ansi: string): string | undefined {
	const trueColorMatch = ansi.match(/\x1b\[(?:38|48);2;(\d{1,3});(\d{1,3});(\d{1,3})m/);
	if (trueColorMatch) {
		return rgbToHex(Number(trueColorMatch[1]), Number(trueColorMatch[2]), Number(trueColorMatch[3]));
	}

	const indexedMatch = ansi.match(/\x1b\[(?:38|48);5;(\d{1,3})m/);
	if (indexedMatch) {
		return xterm256ToHex(Number(indexedMatch[1]));
	}

	return undefined;
}

function safeThemeColor(getter: () => string): string | undefined {
	try {
		return ansiColorToCss(getter());
	} catch {
		return undefined;
	}
}

function getPreviewStyle(theme?: Theme): PreviewStyle {
	const themeMode = getThemeMode(theme);
	const fallback = themeMode === "dark" ? DARK_PREVIEW_PALETTE : LIGHT_PREVIEW_PALETTE;

	if (!theme) {
		return {
			themeMode,
			palette: fallback,
			cacheKey: `${themeMode}|fallback`,
		};
	}

	const card = safeThemeColor(() => theme.getBgAnsi("toolPendingBg")) ?? fallback.card;

	const palette: PreviewPalette = {
		bg: safeThemeColor(() => theme.getBgAnsi("customMessageBg")) ?? fallback.bg,
		card,
		border: safeThemeColor(() => theme.getFgAnsi("border")) ?? fallback.border,
		text: safeThemeColor(() => theme.getFgAnsi("text")) ?? fallback.text,
		muted: safeThemeColor(() => theme.getFgAnsi("muted")) ?? fallback.muted,
		codeBg: adjustCodeBg(card, themeMode),
		link:
			safeThemeColor(() => theme.getFgAnsi("mdLink")) ?? safeThemeColor(() => theme.getFgAnsi("accent")) ?? fallback.link,
		syntaxComment: safeThemeColor(() => theme.getFgAnsi("syntaxComment")) ?? fallback.syntaxComment,
		syntaxKeyword: safeThemeColor(() => theme.getFgAnsi("syntaxKeyword")) ?? fallback.syntaxKeyword,
		syntaxFunction: safeThemeColor(() => theme.getFgAnsi("syntaxFunction")) ?? fallback.syntaxFunction,
		syntaxVariable: safeThemeColor(() => theme.getFgAnsi("syntaxVariable")) ?? fallback.syntaxVariable,
		syntaxString: safeThemeColor(() => theme.getFgAnsi("syntaxString")) ?? fallback.syntaxString,
		syntaxNumber: safeThemeColor(() => theme.getFgAnsi("syntaxNumber")) ?? fallback.syntaxNumber,
		syntaxType: safeThemeColor(() => theme.getFgAnsi("syntaxType")) ?? fallback.syntaxType,
		syntaxOperator: safeThemeColor(() => theme.getFgAnsi("syntaxOperator")) ?? fallback.syntaxOperator,
		syntaxPunctuation: safeThemeColor(() => theme.getFgAnsi("syntaxPunctuation")) ?? fallback.syntaxPunctuation,
	};

	const cacheKey = [
		themeMode,
		palette.bg,
		palette.card,
		palette.border,
		palette.text,
		palette.muted,
		palette.codeBg,
		palette.link,
		palette.syntaxComment,
		palette.syntaxKeyword,
		palette.syntaxFunction,
		palette.syntaxVariable,
		palette.syntaxString,
		palette.syntaxNumber,
		palette.syntaxType,
		palette.syntaxOperator,
		palette.syntaxPunctuation,
	].join("|");

	return {
		themeMode,
		palette,
		cacheKey,
	};
}

interface AssistantMessage {
	index: number;
	markdown: string;
	preview: string;
}

function getAssistantMessages(ctx: ExtensionCommandContext): AssistantMessage[] {
	const branch = ctx.sessionManager.getBranch();
	const messages: AssistantMessage[] = [];
	let messageIndex = 0;

	for (const entry of branch) {
		if (entry.type !== "message") continue;

		const msg = entry.message;
		if (!("role" in msg) || msg.role !== "assistant") continue;

		const textBlocks = msg.content.filter((c): c is { type: "text"; text: string } => c.type === "text" && !!c.text.trim());
		if (textBlocks.length === 0) continue;

		const markdown = textBlocks.map((c) => c.text).join("\n\n");
		const firstLine = markdown.split("\n").find((l) => l.trim().length > 0) ?? "";
		const preview = firstLine.replace(/^#+\s*/, "").slice(0, 80);
		messages.push({ index: messageIndex, markdown, preview });
		messageIndex++;
	}

	return messages;
}

function getLastAssistantMarkdown(ctx: ExtensionCommandContext): string | undefined {
	const messages = getAssistantMessages(ctx);
	return messages.length > 0 ? messages[messages.length - 1]!.markdown : undefined;
}

function isLikelyMathExpression(expr: string): boolean {
	const content = expr.trim();
	if (content.length === 0) return false;

	if (/\\[a-zA-Z]+/.test(content)) return true; // LaTeX commands like \frac, \alpha
	if (/[0-9]/.test(content)) return true;
	if (/[=+\-*/^_<>≤≥±×÷]/u.test(content)) return true;
	if (/[{}]/.test(content)) return true;
	if (/[α-ωΑ-Ω]/u.test(content)) return true;
	if (/^[A-Za-z]$/.test(content)) return true; // single-variable forms like \(x\)

	// Plain words (e.g. escaped markdown like \[not a link\]) are not math.
	if (/^[A-Za-z][A-Za-z\s'".,:;!?-]*[A-Za-z]$/.test(content)) return false;

	return false;
}

function collapseDisplayMathContent(expr: string): string {
	let content = expr.trim();
	if (/\\begin\{[^}]+\}|\\end\{[^}]+\}/.test(content)) {
		return content;
	}
	if (content.includes("\\\\") || content.includes("\n")) {
		content = content.replace(/\\\\\s*/g, " ");
		content = content.replace(/\s*\n\s*/g, " ");
		content = content.replace(/\s{2,}/g, " ").trim();
	}
	return content;
}

function normalizeMathDelimitersInSegment(markdown: string): string {
	let normalized = markdown.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, expr: string) => {
		const content = expr.trim();
		if (!isLikelyMathExpression(content)) return match;
		return content.length > 0 ? `$$\n${content}\n$$` : "$$\n$$";
	});

	normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (match, expr: string) => {
		if (!isLikelyMathExpression(expr)) return match;
		return `$${expr}$`;
	});
	return normalized;
}

function normalizeMathDelimiters(markdown: string): string {
	const lines = markdown.split("\n");
	const out: string[] = [];
	let plainBuffer: string[] = [];
	let inFence = false;
	let fenceChar: "`" | "~" | undefined;
	let fenceLength = 0;

	const flushPlain = () => {
		if (plainBuffer.length === 0) return;
		out.push(normalizeMathDelimitersInSegment(plainBuffer.join("\n")));
		plainBuffer = [];
	};

	for (const line of lines) {
		const trimmed = line.trimStart();
		const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

		if (fenceMatch) {
			const marker = fenceMatch[1]!;
			const markerChar = marker[0] as "`" | "~";
			const markerLength = marker.length;

			if (!inFence) {
				flushPlain();
				inFence = true;
				fenceChar = markerChar;
				fenceLength = markerLength;
				out.push(line);
				continue;
			}

			if (fenceChar === markerChar && markerLength >= fenceLength) {
				inFence = false;
				fenceChar = undefined;
				fenceLength = 0;
			}

			out.push(line);
			continue;
		}

		if (inFence) {
			out.push(line);
		} else {
			plainBuffer.push(line);
		}
	}

	flushPlain();
	return out.join("\n");
}

function normalizeSubSupTagsInSegment(markdown: string): string {
	let normalized = markdown.replace(/<sub>([^<\n]+)<\/sub>/gi, (_match, content: string) => `~${content}~`);
	normalized = normalized.replace(/<sup>([^<\n]+)<\/sup>/gi, (_match, content: string) => `^${content}^`);
	return normalized;
}

function normalizeSubSupTags(markdown: string): string {
	const lines = markdown.split("\n");
	const out: string[] = [];
	let plainBuffer: string[] = [];
	let inFence = false;
	let fenceChar: "`" | "~" | undefined;
	let fenceLength = 0;

	const flushPlain = () => {
		if (plainBuffer.length === 0) return;
		out.push(normalizeSubSupTagsInSegment(plainBuffer.join("\n")));
		plainBuffer = [];
	};

	for (const line of lines) {
		const trimmed = line.trimStart();
		const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

		if (fenceMatch) {
			const marker = fenceMatch[1]!;
			const markerChar = marker[0] as "`" | "~";
			const markerLength = marker.length;

			if (!inFence) {
				flushPlain();
				inFence = true;
				fenceChar = markerChar;
				fenceLength = markerLength;
				out.push(line);
				continue;
			}

			if (fenceChar === markerChar && markerLength >= fenceLength) {
				inFence = false;
				fenceChar = undefined;
				fenceLength = 0;
			}

			out.push(line);
			continue;
		}

		if (inFence) {
			out.push(line);
		} else {
			plainBuffer.push(line);
		}
	}

	flushPlain();
	return out.join("\n");
}

function escapeLatexTextFragment(text: string): string {
	return String(text ?? "")
		.replace(/\\/g, "\\textbackslash{}")
		.replace(/([{}%#$&_])/g, "\\$1")
		.replace(/~/g, "\\textasciitilde{}")
		.replace(/\^/g, "\\textasciicircum{}");
}

function getMathPattern(): RegExp {
	return /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
}

function normalizeLatexAnnotationText(text: string): string {
	return normalizeAnnotationText(text);
}

function escapeLatexText(text: string): string {
	const normalized = normalizeLatexAnnotationText(text);
	if (!normalized) return "";

	const mathPattern = getMathPattern();
	let out = "";
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = mathPattern.exec(normalized)) !== null) {
		const token = match[0] ?? "";
		const start = match.index;
		if (start > lastIndex) {
			out += escapeLatexTextFragment(normalized.slice(lastIndex, start));
		}

		const inlineParenExpr = match[1];
		const displayBracketExpr = match[2];
		const displayDollarExpr = match[3];
		const inlineDollarExpr = match[4];
		let mathLatex = "";

		if (typeof inlineParenExpr === "string" && isLikelyMathExpression(inlineParenExpr)) {
			const content = inlineParenExpr.trim();
			mathLatex = content ? `\\(${content}\\)` : "";
		} else if (typeof displayBracketExpr === "string" && isLikelyMathExpression(displayBracketExpr)) {
			const content = collapseDisplayMathContent(displayBracketExpr);
			mathLatex = content ? `\\(${content}\\)` : "";
		} else if (typeof displayDollarExpr === "string" && isLikelyMathExpression(displayDollarExpr)) {
			const content = collapseDisplayMathContent(displayDollarExpr);
			mathLatex = content ? `\\(${content}\\)` : "";
		} else if (typeof inlineDollarExpr === "string" && isLikelyMathExpression(inlineDollarExpr)) {
			const content = inlineDollarExpr.trim();
			mathLatex = content ? `\\(${content}\\)` : "";
		}

		out += mathLatex || escapeLatexTextFragment(token);
		lastIndex = start + token.length;
		if (token.length === 0) {
			mathPattern.lastIndex += 1;
		}
	}

	if (lastIndex < normalized.length) {
		out += escapeLatexTextFragment(normalized.slice(lastIndex));
	}

	return out.trim();
}

function renderAnnotationCodeSpanPdfLatex(rawToken: string): string {
	const raw = String(rawToken ?? "");
	if (!raw || raw[0] !== "`") return escapeLatexTextFragment(raw);

	let fenceLength = 1;
	while (raw[fenceLength] === "`") fenceLength += 1;
	const fence = "`".repeat(fenceLength);
	if (raw.length < fenceLength * 2 || raw.slice(raw.length - fenceLength) !== fence) {
		return escapeLatexTextFragment(raw);
	}

	return `\\texttt{${escapeLatexTextFragment(raw.slice(fenceLength, raw.length - fenceLength))}}`;
}

function canOpenAnnotationEmphasisDelimiter(source: string, startIndex: number, delimiter: string): boolean {
	if (source.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
	const prev = startIndex > 0 ? source[startIndex - 1] ?? "" : "";
	const next = source[startIndex + delimiter.length] ?? "";
	if (!next || /\s/.test(next)) return false;
	return !isAnnotationWordChar(prev);
}

function canCloseAnnotationEmphasisDelimiter(source: string, startIndex: number, delimiter: string): boolean {
	if (source.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
	const prev = startIndex > 0 ? source[startIndex - 1] ?? "" : "";
	const next = source[startIndex + delimiter.length] ?? "";
	if (!prev || /\s/.test(prev)) return false;
	return !isAnnotationWordChar(next);
}

function renderAnnotationPdfLatexContent(text: string): string {
	const source = String(text ?? "");
	let out = "";
	let plainStart = 0;
	let index = 0;

	while (index < source.length) {
		const token = readAnnotationProtectedTokenAt(source, index);
		if (!token) {
			index += 1;
			continue;
		}

		if (index > plainStart) {
			out += renderAnnotationPlainTextPdfLatex(source.slice(plainStart, index));
		}

		if (token.type === "code") {
			out += renderAnnotationCodeSpanPdfLatex(token.raw);
		} else if (token.type === "math") {
			out += escapeLatexText(token.raw);
		} else {
			out += escapeLatexTextFragment(token.raw);
		}

		index = token.end;
		plainStart = index;
	}

	if (plainStart < source.length) {
		out += renderAnnotationPlainTextPdfLatex(source.slice(plainStart));
	}

	return out;
}

function readAnnotationPdfEmphasisSpanAt(source: string, startIndex: number, delimiter: string, commandName: string): { end: number; latex: string } | null {
	if (!canOpenAnnotationEmphasisDelimiter(source, startIndex, delimiter)) return null;

	let index = startIndex + delimiter.length;
	while (index < source.length) {
		if (source[index] === "\\") {
			index = Math.min(source.length, index + 2);
			continue;
		}

		const protectedToken = readAnnotationProtectedTokenAt(source, index);
		if (protectedToken) {
			index = protectedToken.end;
			continue;
		}

		if (canCloseAnnotationEmphasisDelimiter(source, index, delimiter)) {
			const inner = source.slice(startIndex + delimiter.length, index);
			return {
				end: index + delimiter.length,
				latex: `\\${commandName}{${renderAnnotationPdfLatexContent(inner)}}`,
			};
		}

		index += 1;
	}

	return null;
}

function renderAnnotationPlainTextPdfLatex(text: string): string {
	const source = String(text ?? "");
	let out = "";
	let index = 0;

	while (index < source.length) {
		const strongMatch = readAnnotationPdfEmphasisSpanAt(source, index, "**", "textbf")
			?? readAnnotationPdfEmphasisSpanAt(source, index, "__", "textbf");
		if (strongMatch) {
			out += strongMatch.latex;
			index = strongMatch.end;
			continue;
		}

		const emphasisMatch = readAnnotationPdfEmphasisSpanAt(source, index, "*", "emph")
			?? readAnnotationPdfEmphasisSpanAt(source, index, "_", "emph");
		if (emphasisMatch) {
			out += emphasisMatch.latex;
			index = emphasisMatch.end;
			continue;
		}

		out += escapeLatexTextFragment(source[index] ?? "");
		index += 1;
	}

	return out;
}

function renderAnnotationPdfLatex(text: string): string {
	const normalized = normalizeAnnotationText(text);
	if (!normalized) return "";
	return renderAnnotationPdfLatexContent(normalized).trim();
}

function replaceAnnotationMarkersForPdfInSegment(text: string): string {
	return replaceInlineAnnotationMarkers(
		String(text ?? ""),
		(marker: { body: string }) => {
			const cleaned = renderAnnotationPdfLatex(marker.body);
			if (!cleaned) return "";
			return `\\piannotation{${cleaned}}`;
		},
	);
}

function highlightAnnotationMarkersForPdf(markdown: string): string {
	if (!hasMarkdownAnnotationMarkers(markdown)) return String(markdown ?? "");
	return transformMarkdownOutsideFences(markdown, (segment: string) => replaceAnnotationMarkersForPdfInSegment(segment));
}

function formatMarkdownImageDestination(rawPath: string): string {
	const path = rawPath.trim();
	if (!path) return "";
	const unwrapped = path.startsWith("<") && path.endsWith(">") ? path.slice(1, -1).trim() : path;
	// Angle brackets keep markdown image destinations valid for spaces/parentheses.
	if (/[\s<>()]/.test(unwrapped)) return `<${unwrapped}>`;
	return unwrapped;
}

function normalizeObsidianImages(markdown: string): string {
	// Convert ![[path|alt]] and ![[path]] to standard markdown ![alt](path)
	return markdown
		.replace(/!\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_match, path: string, alt: string) => {
			return `![${alt}](${formatMarkdownImageDestination(path)})`;
		})
		.replace(/!\[\[([^\]]+)\]\]/g, (_match, path: string) => {
			return `![](${formatMarkdownImageDestination(path)})`;
		});
}

function extractLikelyImageDestination(rawDestination: string): string {
	const trimmed = rawDestination.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("<")) {
		const close = trimmed.indexOf(">");
		if (close > 0) return trimmed.slice(1, close).trim();
	}
	const firstWhitespace = trimmed.search(/\s/);
	return firstWhitespace === -1 ? trimmed : trimmed.slice(0, firstWhitespace);
}

function isLikelyRelativeLocalImageDestination(destination: string): boolean {
	if (!destination) return false;
	if (destination.startsWith("/") || destination.startsWith("#")) return false;
	if (destination.startsWith("\\\\")) return false;
	if (/^[A-Za-z]:[\\/]/.test(destination)) return false;

	const lower = destination.toLowerCase();
	if (
		lower.startsWith("http://")
		|| lower.startsWith("https://")
		|| lower.startsWith("data:")
		|| lower.startsWith("file:")
		|| lower.startsWith("blob:")
		|| lower.startsWith("about:")
	) {
		return false;
	}

	return true;
}

function hasLikelyRelativeLocalImages(markdown: string): boolean {
	const normalized = normalizeObsidianImages(markdown);
	const imageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;
	while ((match = imageRegex.exec(normalized)) !== null) {
		const destination = extractLikelyImageDestination(match[1] ?? "");
		if (isLikelyRelativeLocalImageDestination(destination)) {
			return true;
		}
	}
	return false;
}

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx", "rmd", "qmd"]);

const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
	js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
	py: "python", pyw: "python",
	rb: "ruby",
	rs: "rust",
	go: "go",
	java: "java",
	kt: "kotlin", kts: "kotlin",
	swift: "swift",
	c: "c", h: "c",
	cpp: "cpp", cxx: "cpp", cc: "cpp", hpp: "cpp", hxx: "cpp",
	cs: "csharp",
	php: "php",
	sh: "bash", bash: "bash", zsh: "bash",
	fish: "fish",
	ps1: "powershell",
	sql: "sql",
	html: "html", htm: "html",
	css: "css", scss: "scss", sass: "sass", less: "less",
	json: "json", jsonc: "json", json5: "json",
	yaml: "yaml", yml: "yaml",
	toml: "toml",
	xml: "xml",
	dockerfile: "dockerfile",
	makefile: "makefile",
	cmake: "cmake",
	lua: "lua",
	perl: "perl", pl: "perl",
	r: "r",
	jl: "julia",
	scala: "scala",
	clj: "clojure",
	ex: "elixir", exs: "elixir",
	erl: "erlang",
	hs: "haskell",
	ml: "ocaml",
	vim: "vim",
	graphql: "graphql",
	proto: "protobuf",
	tf: "hcl", hcl: "hcl",
	tex: "latex", latex: "latex",
	qmd: "markdown",
	diff: "diff", patch: "diff",
	f90: "fortran", f95: "fortran", f03: "fortran", f: "fortran", for: "fortran",
	m: "matlab",
};

function detectLanguageFromPath(filePath: string): string | undefined {
	const ext = extname(filePath).replace(/^\./, "").toLowerCase();
	if (ext) return EXT_TO_LANG[ext];

	const baseLower = basename(filePath).toLowerCase();
	if (baseLower === "dockerfile") return "dockerfile";
	if (baseLower === "makefile") return "makefile";
	return undefined;
}

function isMarkdownFile(filePath: string): boolean {
	const ext = extname(filePath).replace(/^\./, "").toLowerCase();
	return MARKDOWN_EXTENSIONS.has(ext);
}

const LATEX_EXTENSIONS = new Set(["tex", "latex"]);

function isLatexFile(filePath: string): boolean {
	const ext = extname(filePath).replace(/^\./, "").toLowerCase();
	return LATEX_EXTENSIONS.has(ext);
}

function normalizeFenceLanguage(language: string | undefined): string | undefined {
	const trimmed = typeof language === "string" ? language.trim().toLowerCase() : "";
	if (!trimmed) return undefined;
	if (trimmed === "patch" || trimmed === "udiff") return "diff";
	return trimmed;
}

function getLongestFenceRun(text: string, fenceChar: "`" | "~"): number {
	const regex = fenceChar === "`" ? /`+/g : /~+/g;
	let max = 0;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		max = Math.max(max, match[0].length);
	}
	return max;
}

function wrapCodeAsMarkdown(code: string, lang?: string, filePath?: string): string {
	const header = filePath ? `# ${basename(filePath)}\n\n` : "";
	const source = String(code ?? "").replace(/\r\n/g, "\n").trimEnd();
	const language = normalizeFenceLanguage(lang) ?? "";
	const maxBackticks = getLongestFenceRun(source, "`");
	const maxTildes = getLongestFenceRun(source, "~");

	let markerChar: "`" | "~" = "`";
	if (maxBackticks === 0 && maxTildes === 0) {
		markerChar = "`";
	} else if (maxTildes < maxBackticks) {
		markerChar = "~";
	} else if (maxBackticks < maxTildes) {
		markerChar = "`";
	} else {
		markerChar = maxBackticks > 0 ? "~" : "`";
	}

	const markerLength = Math.max(3, (markerChar === "`" ? maxBackticks : maxTildes) + 1);
	const marker = markerChar.repeat(markerLength);
	return `${header}${marker}${language}\n${source}\n${marker}`;
}

function extractFenceInfoLanguage(info: string): string | undefined {
	const firstToken = String(info ?? "").trim().split(/\s+/)[0]?.replace(/^\./, "") ?? "";
	return normalizeFenceLanguage(firstToken || undefined);
}

function normalizeMarkdownFencedBlocks(markdown: string): string {
	const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
	const out: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const openingMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})([^\n]*)$/);
		if (!openingMatch) {
			out.push(line);
			continue;
		}

		const indent = openingMatch[1] ?? "";
		const openingFence = openingMatch[2]!;
		const openingSuffix = openingMatch[3] ?? "";
		const fenceChar = openingFence[0] as "`" | "~";
		const fenceLength = openingFence.length;

		let closingIndex = -1;
		for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
			const innerLine = lines[innerIndex] ?? "";
			const closingMatch = innerLine.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
			if (!closingMatch) continue;
			const closingFence = closingMatch[1]!;
			if (closingFence[0] !== fenceChar || closingFence.length < fenceLength) continue;
			closingIndex = innerIndex;
			break;
		}

		if (closingIndex === -1) {
			out.push(line);
			continue;
		}

		const contentLines = lines.slice(index + 1, closingIndex);
		const content = contentLines.join("\n");
		const maxBackticks = getLongestFenceRun(content, "`");
		const maxTildes = getLongestFenceRun(content, "~");
		const currentMaxRun = fenceChar === "`" ? maxBackticks : maxTildes;

		if (currentMaxRun < fenceLength) {
			out.push(line, ...contentLines, lines[closingIndex] ?? "");
			index = closingIndex;
			continue;
		}

		const neededBackticks = Math.max(3, maxBackticks + 1);
		const neededTildes = Math.max(3, maxTildes + 1);
		let markerChar: "`" | "~" = fenceChar;

		if (neededBackticks < neededTildes) {
			markerChar = "`";
		} else if (neededTildes < neededBackticks) {
			markerChar = "~";
		} else if (fenceChar === "`") {
			markerChar = "~";
		}

		const markerLength = markerChar === "`" ? neededBackticks : neededTildes;
		const marker = markerChar.repeat(markerLength);
		out.push(`${indent}${marker}${openingSuffix}`, ...contentLines, `${indent}${marker}`);
		index = closingIndex;
	}

	return out.join("\n");
}

function hasMarkdownDiffFence(markdown: string): boolean {
	const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const openingMatch = line.match(/^\s{0,3}(`{3,}|~{3,})([^\n]*)$/);
		if (!openingMatch) continue;

		const openingFence = openingMatch[1]!;
		const infoLanguage = extractFenceInfoLanguage(openingMatch[2] ?? "");
		if (infoLanguage !== "diff") continue;

		const fenceChar = openingFence[0];
		const fenceLength = openingFence.length;
		for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
			const innerLine = lines[innerIndex] ?? "";
			const closingMatch = innerLine.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
			if (!closingMatch) continue;
			const closingFence = closingMatch[1]!;
			if (closingFence[0] !== fenceChar || closingFence.length < fenceLength) continue;
			return true;
		}
	}

	return false;
}

function getBrowserCandidates(): string[] {
	if (process.platform === "darwin") {
		return [
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		];
	}

	if (process.platform === "win32") {
		return [
			"C:/Program Files/Google/Chrome/Application/chrome.exe",
			"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
			"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
			"C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
		];
	}

	return [
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		"/snap/bin/chromium",
	];
}

function findBrowserExecutable(): string | undefined {
	const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || process.env.BROWSER;
	if (envPath && existsSync(envPath)) {
		return envPath;
	}
	return getBrowserCandidates().find((candidate) => existsSync(candidate));
}

function getCachePaths(markdownPage: string, styleKey: string) {
	const hash = createHash("sha256")
		.update(RENDER_VERSION)
		.update("\u0000")
		.update(styleKey)
		.update("\u0000")
		.update(markdownPage)
		.digest("hex");
	return {
		pngPath: join(CACHE_DIR, `${hash}.png`),
		metaPath: join(CACHE_DIR, `${hash}.json`),
	};
}

function buildRenderCacheKey(styleKey: string, resourcePath?: string, isLatex?: boolean): string {
	const format = isLatex ? "latex" : "markdown";
	const resolvedResourcePath = resourcePath ? resolvePath(resourcePath) : "";
	return `${styleKey}\u0000${format}\u0000${resolvedResourcePath}`;
}

async function readCachedPage(markdownPage: string, styleKey: string): Promise<CachedPage | undefined> {
	const { pngPath, metaPath } = getCachePaths(markdownPage, styleKey);
	if (!existsSync(pngPath)) {
		return undefined;
	}

	try {
		const buffer = await readFile(pngPath);
		let truncatedHeight = false;
		let pageCount: number | undefined;
		if (existsSync(metaPath)) {
			const meta = JSON.parse(await readFile(metaPath, "utf-8")) as { truncatedHeight?: boolean; pageCount?: number };
			truncatedHeight = meta.truncatedHeight === true;
			pageCount = meta.pageCount;
		}
		return { buffer, truncatedHeight, pageCount };
	} catch {
		return undefined;
	}
}

async function writeCachedPage(markdownPage: string, styleKey: string, page: CachedPage): Promise<void> {
	const { pngPath, metaPath } = getCachePaths(markdownPage, styleKey);
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(pngPath, page.buffer);
	const meta: Record<string, unknown> = { truncatedHeight: page.truncatedHeight };
	if (page.pageCount != null) meta.pageCount = page.pageCount;
	await writeFile(metaPath, JSON.stringify(meta), "utf-8");
}

async function waitForPageRenderReady(page: puppeteer.Page): Promise<void> {
	await page.evaluate(async () => {
		if ("fonts" in document) {
			await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
		}
	});
}

function prepareBrowserPreviewMarkdown(markdown: string, isLatex?: boolean): {
	normalizedMarkdown: string;
	pandocMarkdown: string;
	annotationPlaceholders: PreviewAnnotationPlaceholder[];
} {
	const normalizedMarkdown = isLatex ? markdown : normalizeMarkdownFencedBlocks(normalizeObsidianImages(normalizeMathDelimiters(markdown)));
	if (isLatex || !hasMarkdownAnnotationMarkers(normalizedMarkdown)) {
		return { normalizedMarkdown, pandocMarkdown: normalizedMarkdown, annotationPlaceholders: [] };
	}

	const prepared = prepareMarkdownForPandocPreview(normalizedMarkdown, PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX) as {
		markdown?: string;
		placeholders?: PreviewAnnotationPlaceholder[];
	};
	return {
		normalizedMarkdown,
		pandocMarkdown: typeof prepared.markdown === "string" ? prepared.markdown : normalizedMarkdown,
		annotationPlaceholders: Array.isArray(prepared.placeholders) ? prepared.placeholders : [],
	};
}

async function renderPreview(markdown: string, style: PreviewStyle, signal?: AbortSignal, resourcePath?: string, skipCache?: boolean, isLatex?: boolean): Promise<RenderPreviewResult> {
	const { normalizedMarkdown, pandocMarkdown, annotationPlaceholders } = prepareBrowserPreviewMarkdown(markdown, isLatex);
	const cacheKey = buildRenderCacheKey(style.cacheKey, resourcePath, isLatex);

	// Check cache for the full render (keyed on full markdown content).
	const cached = skipCache ? undefined : await readCachedPage(normalizedMarkdown, cacheKey);
	if (cached) {
		// Cached result stores page count in meta; individual page PNGs are stored separately.
		const meta = cached as CachedPage & { pageCount?: number };
		const pageCount = meta.pageCount ?? 1;
		const pages: PreviewPage[] = [];
		for (let i = 0; i < pageCount; i++) {
			const pageKey = `${normalizedMarkdown}\u0000page${i}`;
			const pageCached = i === 0 ? cached : await readCachedPage(pageKey, cacheKey);
			if (!pageCached) {
				// Cache is incomplete; re-render.
				return renderPreview(markdown, style, signal, resourcePath, true, isLatex);
			}
			pages.push({
				base64Png: pageCached.buffer.toString("base64"),
				truncatedHeight: pageCached.truncatedHeight,
				index: i,
				total: pageCount,
			});
		}
		return { pages, themeMode: style.themeMode, truncatedPages: false };
	}

	await mkdir(CACHE_DIR, { recursive: true });

	const fragmentHtml = await renderMarkdownToHtmlWithPandoc(pandocMarkdown, resourcePath, isLatex);
	const html = buildBrowserHtmlFromPandocFragment(fragmentHtml, style, resourcePath, annotationPlaceholders);

	let browser: puppeteer.Browser | undefined;
	let browserPage: puppeteer.Page | undefined;
	let tempHtmlPath: string | undefined;

	try {
		if (signal?.aborted) throw new Error("Preview rendering cancelled.");

		const executablePath = findBrowserExecutable();
		if (!executablePath) {
			throw new Error(
				"No Chromium-based browser was found. Set PUPPETEER_EXECUTABLE_PATH to your Chrome/Edge/Chromium binary.",
			);
		}

		const args = ["--disable-gpu", "--font-render-hinting=medium"];
		if (process.platform === "linux") {
			args.push("--no-sandbox", "--disable-setuid-sandbox");
		}

		browser = await puppeteer.launch({ headless: true, executablePath, args });
		browserPage = await browser.newPage();

		const loadHtml = async (height: number) => {
			await browserPage!.setViewport({
				width: VIEWPORT_WIDTH_PX,
				height,
				deviceScaleFactor: 2,
			});
			if (!tempHtmlPath) {
				tempHtmlPath = join(CACHE_DIR, `_render_tmp_${Date.now()}.html`);
				await writeFile(tempHtmlPath, html, "utf-8");
			}
			await browserPage!.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: "domcontentloaded" });
			await waitForPageRenderReady(browserPage!);
			await browserPage!.waitForFunction(
				"window.__mermaidDone === true",
				{ timeout: 15000 }
			).catch(() => {});
		};

		// First pass: measure content height.
		await loadHtml(900);
		const contentHeight = await browserPage.evaluate(() => {
			const root = document.getElementById("preview-root");
			if (!root) return 900;
			const rect = root.getBoundingClientRect();
			return Math.ceil(rect.height + 40);
		});

		if (signal?.aborted) throw new Error("Preview rendering cancelled.");

		// Clamp to maximum render height.
		const renderHeight = Math.max(500, Math.min(MAX_RENDER_HEIGHT_PX, contentHeight));
		const truncatedPages = contentHeight > MAX_RENDER_HEIGHT_PX;

		// Second pass: render at full height.
		if (renderHeight !== 900) {
			await loadHtml(renderHeight);
		}

		// Take full screenshot and slice into pages.
		const fullScreenshot = (await browserPage.screenshot({ type: "png" })) as Buffer;

		if (tempHtmlPath) await unlink(tempHtmlPath).catch(() => {});
		tempHtmlPath = undefined;

		// Import sharp-like slicing via puppeteer clip regions, or slice the
		// full PNG by re-screenshotting with clip.  Since we already have the
		// full page loaded, clip is simplest.
		const pageCount = Math.max(1, Math.ceil(renderHeight / PAGE_HEIGHT_PX));
		const pages: PreviewPage[] = [];

		if (pageCount === 1) {
			// Single page — use the full screenshot directly.
			pages.push({
				base64Png: fullScreenshot.toString("base64"),
				truncatedHeight: false,
				index: 0,
				total: 1,
			});
			await writeCachedPage(normalizedMarkdown, cacheKey, {
				buffer: fullScreenshot,
				truncatedHeight: false,
				pageCount: 1,
			}).catch(() => {});
		} else {
			// Multiple pages — use clip regions.
			for (let i = 0; i < pageCount; i++) {
				if (signal?.aborted) throw new Error("Preview rendering cancelled.");

				const y = i * PAGE_HEIGHT_PX;
				const height = Math.min(PAGE_HEIGHT_PX, renderHeight - y);

				const pageScreenshot = (await browserPage.screenshot({
					type: "png",
					clip: {
						x: 0,
						y,
						width: VIEWPORT_WIDTH_PX,
						height,
					},
				})) as Buffer;

				pages.push({
					base64Png: pageScreenshot.toString("base64"),
					truncatedHeight: false,
					index: i,
					total: pageCount,
				});

				// Cache each page slice.
				const pageKey = i === 0 ? normalizedMarkdown : `${normalizedMarkdown}\u0000page${i}`;
				await writeCachedPage(pageKey, cacheKey, {
					buffer: pageScreenshot,
					truncatedHeight: false,
					pageCount: i === 0 ? pageCount : undefined,
				}).catch(() => {});
			}
		}

		return { pages, themeMode: style.themeMode, truncatedPages };
	} finally {
		if (tempHtmlPath) await unlink(tempHtmlPath).catch(() => {});
		if (browserPage) await browserPage.close().catch(() => {});
		if (browser) await browser.close().catch(() => {});
	}
}


class MarkdownPreviewOverlay {
	private container = new Container();
	private pageIndex = 0;
	private statusLine: string | undefined;
	private isRefreshing = false;
	private isOpeningBrowser = false;
	private imageIdsByPage = new Map<number, number>();
	private readonly useKittyImageDeletion = getCapabilities().images === "kitty";

	constructor(
		private tui: TUI,
		private theme: Theme,
		private preview: RenderPreviewResult,
		private done: () => void,
		private refresh: () => Promise<RenderPreviewResult>,
		private openInBrowser: () => Promise<void>,
	) {
		this.rebuild();
	}

	private currentPage(): PreviewPage {
		return this.preview.pages[this.pageIndex]!;
	}

	private getImageIdForPage(pageIndex: number): number | undefined {
		if (!this.useKittyImageDeletion) return undefined;
		const existing = this.imageIdsByPage.get(pageIndex);
		if (existing !== undefined) return existing;
		const created = allocateImageId();
		this.imageIdsByPage.set(pageIndex, created);
		return created;
	}

	private clearRenderedImages(): void {
		if (!this.useKittyImageDeletion) return;
		for (const imageId of this.imageIdsByPage.values()) {
			try {
				this.tui.terminal.write(deleteKittyImage(imageId));
			} catch {
				// no-op
			}
		}
		this.imageIdsByPage.clear();
	}

	private rebuild(): void {
		this.container.clear();

		const title = `${this.theme.bold("Markdown preview")} ${this.theme.fg("dim", `(${this.pageIndex + 1}/${this.preview.pages.length})`)}`;
		this.container.addChild(new Text(this.theme.fg("accent", title), 0, 0));

		const controls: string[] = [];
		if (this.preview.pages.length > 1) controls.push("←/→ page");
		controls.push(`${keyHint("tui.select.cancel", "close")}`, "r refresh", "o open browser");
		this.container.addChild(new Text(this.theme.fg("dim", controls.join(" • ")), 0, 0));

		const page = this.currentPage();
		if (this.preview.truncatedPages || page.truncatedHeight) {
			const notes: string[] = [];
			if (this.preview.truncatedPages) notes.push("message split into max preview pages");
			if (page.truncatedHeight) notes.push("current page clipped for terminal preview");
			this.container.addChild(new Text(this.theme.fg("warning", `Note: ${notes.join("; ")}.`), 0, 0));
		}

		if (this.statusLine) {
			this.container.addChild(new Text(this.statusLine, 0, 0));
		}

		this.container.addChild(new Spacer(1));
		this.container.addChild(
			new Image(
				page.base64Png,
				"image/png",
				{ fallbackColor: (str) => this.theme.fg("muted", str) },
				{ maxWidthCells: 280, imageId: this.getImageIdForPage(page.index) },
			),
		);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.clearRenderedImages();
			this.done();
			return;
		}

		if (matchesKey(data, "left") && this.pageIndex > 0) {
			this.clearRenderedImages();
			this.pageIndex--;
			this.statusLine = undefined;
			this.rebuild();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, "right") && this.pageIndex < this.preview.pages.length - 1) {
			this.clearRenderedImages();
			this.pageIndex++;
			this.statusLine = undefined;
			this.rebuild();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, "o") && !this.isOpeningBrowser) {
			this.isOpeningBrowser = true;
			this.statusLine = this.theme.fg("warning", "Opening browser preview...");
			this.rebuild();
			this.tui.requestRender();

			void this.openInBrowser()
				.then(() => {
					this.statusLine = this.theme.fg("success", "Opened preview in browser.");
				})
				.catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					this.statusLine = this.theme.fg("error", `Browser open failed: ${message}`);
				})
				.finally(() => {
					this.isOpeningBrowser = false;
					this.rebuild();
					this.tui.requestRender();
				});
			return;
		}

		if (matchesKey(data, "r") && !this.isRefreshing) {
			this.isRefreshing = true;
			this.statusLine = this.theme.fg("warning", "Refreshing preview for current theme...");
			this.rebuild();
			this.tui.requestRender();

			void this.refresh()
				.then((preview) => {
					this.clearRenderedImages();
					this.preview = preview;
					this.pageIndex = Math.min(this.pageIndex, Math.max(0, preview.pages.length - 1));
					this.statusLine = this.theme.fg("success", `Refreshed (${preview.themeMode} mode).`);
				})
				.catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					this.statusLine = this.theme.fg("error", `Refresh failed: ${message}`);
				})
				.finally(() => {
					this.isRefreshing = false;
					this.rebuild();
					this.tui.requestRender();
				});
		}
	}

	render(width: number): string[] {
		return this.container.render(width);
	}

	invalidate(): void {
		this.container.invalidate();
		this.rebuild();
	}

	dispose(): void {
		this.clearRenderedImages();
	}
}

async function renderWithLoader(ctx: ExtensionCommandContext, markdown: string, resourcePath?: string, isLatex?: boolean): Promise<RenderWithLoaderResult | null> {
	type LoaderResult = { ok: true; preview: RenderPreviewResult } | { ok: false; error: string } | { ok: false; cancelled: true };

	const result = await ctx.ui.custom<LoaderResult>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, "Rendering markdown + LaTeX preview...");
		let settled = false;
		const resolve = (value: LoaderResult) => {
			if (settled) return;
			settled = true;
			done(value);
		};

		loader.onAbort = () => resolve({ ok: false, cancelled: true });

		void (async () => {
			try {
				const style = getPreviewStyle(ctx.ui.theme);
				const preview = await renderPreview(markdown, style, loader.signal, resourcePath, undefined, isLatex);
				if (loader.signal.aborted) {
					resolve({ ok: false, cancelled: true });
					return;
				}
				resolve({ ok: true, preview });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				resolve({ ok: false, error: message });
			}
		})();

		return loader;
	});

	if (!result) {
		try {
			const style = getPreviewStyle(ctx.ui.theme);
			const preview = await renderPreview(markdown, style, undefined, resourcePath, undefined, isLatex);
			return { preview, supportsCustomUi: false };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Preview failed: ${message}`, "error");
			return null;
		}
	}

	if (!result.ok) {
		if ("cancelled" in result && result.cancelled) {
			ctx.ui.notify("Preview cancelled.", "info");
			return null;
		}
		if ("error" in result) {
			ctx.ui.notify(`Preview failed: ${result.error}`, "error");
			return null;
		}
		ctx.ui.notify("Preview failed.", "error");
		return null;
	}

	return {
		preview: result.preview,
		supportsCustomUi: true,
	};
}

async function pickAssistantMessage(ctx: ExtensionCommandContext): Promise<string | null> {
	const messages = getAssistantMessages(ctx);

	if (messages.length === 0) {
		ctx.ui.notify("No assistant messages found in the current branch.", "warning");
		return null;
	}

	if (messages.length === 1) {
		return messages[0]!.markdown;
	}

	const items: SelectItem[] = messages.map((msg, i) => ({
		value: String(i),
		label: `Response ${msg.index + 1}`,
		description: msg.preview,
	}));

	const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select Response to Preview")), 1, 0));

		const selectList = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		// Start with the last (most recent) item selected
		for (let i = 0; i < items.length - 1; i++) {
			selectList.handleInput("\x1b[B"); // simulate down arrow
		}

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);
		container.addChild(selectList);

		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));
		container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (result === null) return null;
	const selected = messages[Number(result)];
	return selected ? selected.markdown : null;
}

async function openPreview(ctx: ExtensionCommandContext, markdownOverride?: string, resourcePath?: string, isLatex?: boolean): Promise<void> {
	const markdown = markdownOverride ?? getLastAssistantMarkdown(ctx);
	if (!markdown) {
		ctx.ui.notify("No assistant markdown found in the current branch.", "warning");
		return;
	}

	const rendered = await renderWithLoader(ctx, markdown, resourcePath, isLatex);
	if (!rendered) return;

	const { preview: initialPreview, supportsCustomUi } = rendered;
	if (!supportsCustomUi) {
		const pageCount = initialPreview.pages.length;
		ctx.ui.notify(
			`Preview rendered (${pageCount} page${pageCount === 1 ? "" : "s"}), but interactive preview display isn't available in this mode.`,
			"info",
		);
		return;
	}

	// NOTE: Keep this in non-overlay mode.
	// Overlay compositing currently truncates terminal image protocol sequences
	// (kitty/iTerm), which causes raw image payload fragments to appear instead
	// of the rendered preview.
	await ctx.ui.custom<void>((tui, theme, _kb, done) =>
		new MarkdownPreviewOverlay(
			tui,
			theme,
			initialPreview,
			done,
			async () => {
				const style = getPreviewStyle(ctx.ui.theme);
				const refreshed = await renderPreview(markdown, style, undefined, resourcePath, true, isLatex);
				return refreshed;
			},
			async () => {
				await openPreviewInBrowser(ctx, markdown, resourcePath, isLatex);
			},
		),
	);
}

async function openFileInDefaultBrowser(filePath: string): Promise<void> {
	const target = pathToFileURL(filePath).href;
	const openCommand =
		process.platform === "darwin"
			? { command: "open", args: [target] }
			: process.platform === "win32"
				? { command: "cmd", args: ["/c", "start", "", target] }
				: { command: "xdg-open", args: [target] };

	await new Promise<void>((resolve, reject) => {
		const child = spawn(openCommand.command, openCommand.args, {
			stdio: "ignore",
			detached: true,
		});
		child.once("error", reject);
		child.once("spawn", () => {
			child.unref();
			resolve();
		});
	});
}

async function renderMarkdownToHtmlWithPandoc(markdown: string, resourcePath?: string, isLatex?: boolean): Promise<string> {
	const pandocCommand = process.env.PANDOC_PATH?.trim() || "pandoc";
	const pandocInput = isLatex ? markdown : normalizeMarkdownFencedBlocks(markdown);
	const inputFormat = isLatex ? "latex" : "markdown+lists_without_preceding_blankline-blank_before_blockquote-blank_before_header+tex_math_dollars+autolink_bare_uris-raw_html";
	const args = ["-f", inputFormat, "-t", "html5", "--mathml", "--wrap=none"];
	if (resourcePath) args.push(`--resource-path=${resourcePath}`);

	return await new Promise<string>((resolve, reject) => {
		const child = spawn(pandocCommand, args, { stdio: ["pipe", "pipe", "pipe"] });
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		let settled = false;

		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};
		const succeed = (html: string) => {
			if (settled) return;
			settled = true;
			resolve(html);
		};

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});
		child.stderr.on("data", (chunk: Buffer | string) => {
			stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});

		child.once("error", (error) => {
			const errno = error as NodeJS.ErrnoException;
			if (errno.code === "ENOENT") {
				fail(
					new Error(
						`pandoc was not found. Install pandoc or set PANDOC_PATH to the pandoc binary.`,
					),
				);
				return;
			}
			fail(error);
		});

		child.once("close", (code) => {
			if (settled) return;
			if (code === 0) {
				succeed(Buffer.concat(stdoutChunks).toString("utf-8"));
				return;
			}
			const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
			fail(new Error(`pandoc failed with exit code ${code}${stderr ? `: ${stderr}` : ""}`));
		});

		child.stdin.end(pandocInput);
	});
}

const PDF_PREAMBLE = `\\usepackage{titlesec}
\\titleformat{\\section}{\\Large\\bfseries\\sffamily}{}{0pt}{}[\\vspace{2pt}\\titlerule]
\\titleformat{\\subsection}{\\large\\bfseries\\sffamily}{}{0pt}{}
\\titleformat{\\subsubsection}{\\normalsize\\bfseries\\sffamily}{}{0pt}{}
\\titlespacing*{\\section}{0pt}{1.5ex plus 0.5ex minus 0.2ex}{1ex plus 0.2ex}
\\titlespacing*{\\subsection}{0pt}{1.2ex plus 0.4ex minus 0.2ex}{0.6ex plus 0.1ex}
\\usepackage{enumitem}
\\setlist[itemize]{nosep, leftmargin=1.5em}
\\setlist[enumerate]{nosep, leftmargin=1.5em}
\\usepackage{parskip}
\\usepackage{xcolor}
\\usepackage{varwidth}
\\definecolor{PiAnnotationBg}{HTML}{EAF3FF}
\\definecolor{PiAnnotationBorder}{HTML}{8CB8FF}
\\definecolor{PiAnnotationText}{HTML}{1F5FBF}
\\definecolor{PiDiffAddText}{HTML}{1A7F37}
\\definecolor{PiDiffDelText}{HTML}{CF222E}
\\definecolor{PiDiffMetaText}{HTML}{57606A}
\\definecolor{PiDiffHunkText}{HTML}{0969DA}
\\newcommand{\\piannotation}[1]{\\begingroup\\setlength{\\fboxsep}{1.5pt}\\fcolorbox{PiAnnotationBorder}{PiAnnotationBg}{\\begin{varwidth}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}\\raggedright\\textcolor{PiAnnotationText}{\\sffamily\\strut #1}\\end{varwidth}}\\endgroup}
\\newcommand{\\PiDiffAddTok}[1]{\\textcolor{PiDiffAddText}{#1}}
\\newcommand{\\PiDiffDelTok}[1]{\\textcolor{PiDiffDelText}{#1}}
\\newcommand{\\PiDiffMetaTok}[1]{\\textcolor{PiDiffMetaText}{#1}}
\\newcommand{\\PiDiffHunkTok}[1]{\\textcolor{PiDiffHunkText}{#1}}
\\newcommand{\\PiDiffHeaderTok}[1]{\\textcolor{PiDiffHunkText}{\\textbf{#1}}}
\\usepackage{fvextra}
\\makeatletter
\\@ifundefined{Highlighting}{%
  \\DefineVerbatimEnvironment{Highlighting}{Verbatim}{commandchars=\\\\\\{\\},breaklines,breakanywhere}%
}{%
  \\RecustomVerbatimEnvironment{Highlighting}{Verbatim}{commandchars=\\\\\\{\\},breaklines,breakanywhere}%
}
\\makeatother
`;

const PDF_PREAMBLE_PATH = join(CACHE_DIR, "_pdf_preamble.tex");

async function ensurePdfPreamble(): Promise<string> {
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(PDF_PREAMBLE_PATH, PDF_PREAMBLE, "utf-8");
	return PDF_PREAMBLE_PATH;
}

async function compileLatexToPdf(latexSource: string, outputPath: string, resourcePath?: string): Promise<void> {
	const engine = process.env.PANDOC_PDF_ENGINE?.trim() || "xelatex";
	const tmpDir = join(CACHE_DIR, `_latex_${Date.now()}`);
	await mkdir(tmpDir, { recursive: true });

	const texPath = join(tmpDir, "input.tex");
	await writeFile(texPath, latexSource, "utf-8");

	// Symlink resource directory contents so \includegraphics can find figures
	if (resourcePath) {
		const { readdirSync } = await import("node:fs");
		try {
			for (const entry of readdirSync(resourcePath)) {
				const src = join(resourcePath, entry);
				const dest = join(tmpDir, entry);
				try { await import("node:fs/promises").then(fs => fs.symlink(src, dest)); } catch { /* ignore collisions */ }
			}
		} catch { /* resource dir unreadable, skip */ }
	}

	return await new Promise<void>((resolve, reject) => {
		// Run twice for cross-references (\ref, \eqref, \label)
		const runLatex = (pass: number) => {
			const child = spawn(engine, [
				"-interaction=nonstopmode",
				"-halt-on-error",
				"-output-directory", tmpDir,
				texPath,
			], { stdio: ["pipe", "pipe", "pipe"], cwd: tmpDir });

			const stderrChunks: Buffer[] = [];
			const stdoutChunks: Buffer[] = [];
			child.stdout.on("data", (chunk: Buffer | string) => {
				stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
			});
			child.stderr.on("data", (chunk: Buffer | string) => {
				stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
			});

			child.once("error", (error) => {
				const errno = error as NodeJS.ErrnoException;
				if (errno.code === "ENOENT") {
					reject(new Error(
						`${engine} was not found. Install TeX Live (brew install --cask mactex) or set PANDOC_PDF_ENGINE.`,
					));
					return;
				}
				reject(error);
			});

			child.once("close", (code) => {
				if (code !== 0 && pass === 2) {
					const log = Buffer.concat(stdoutChunks).toString("utf-8");
					// Extract the first LaTeX error line for a useful message
					const errorMatch = log.match(/^! .+$/m);
					const hint = errorMatch ? errorMatch[0] : "";
					reject(new Error(`${engine} failed (exit ${code})${hint ? `: ${hint}` : ""}`));
					return;
				}
				if (pass === 1) {
					runLatex(2);
				} else {
					// Copy PDF to output path
					const generatedPdf = join(tmpDir, "input.pdf");
					import("node:fs/promises").then(fs =>
						fs.copyFile(generatedPdf, outputPath).then(() => resolve())
					).catch(reject);
				}
			});

			child.stdin.end();
		};

		runLatex(1);
	});
}

async function renderMarkdownToPdf(markdown: string, outputPath: string, resourcePath?: string): Promise<void> {
	const pandocCommand = process.env.PANDOC_PATH?.trim() || "pandoc";
	const pandocInput = normalizeMarkdownFencedBlocks(markdown);
	const pdfEngine = process.env.PANDOC_PDF_ENGINE?.trim() || "xelatex";
	const preamblePath = await ensurePdfPreamble();
	const args = [
		"-f", "markdown+lists_without_preceding_blankline-blank_before_blockquote-blank_before_header+tex_math_dollars+autolink_bare_uris+superscript+subscript-raw_html",
		"-o", outputPath,
		`--pdf-engine=${pdfEngine}`,
		"-V", "geometry:margin=2.2cm",
		"-V", "fontsize=11pt",
		"-V", "linestretch=1.25",
		"-V", "urlcolor=blue",
		"-V", "linkcolor=blue",
		"--include-in-header", preamblePath,
	];
	if (resourcePath) args.push(`--resource-path=${resourcePath}`);

	return await new Promise<void>((resolve, reject) => {
		const child = spawn(pandocCommand, args, { stdio: ["pipe", "pipe", "pipe"] });
		const stderrChunks: Buffer[] = [];
		let settled = false;

		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		child.stderr.on("data", (chunk: Buffer | string) => {
			stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});

		child.once("error", (error) => {
			const errno = error as NodeJS.ErrnoException;
			if (errno.code === "ENOENT") {
				fail(
					new Error(
						`pandoc was not found. Install pandoc or set PANDOC_PATH to the pandoc binary.`,
					),
				);
				return;
			}
			fail(error);
		});

		child.once("close", (code) => {
			if (settled) return;
			settled = true;
			if (code === 0) {
				resolve();
				return;
			}
			const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
			const hint = stderr.includes("not found") || stderr.includes("pdflatex") || stderr.includes("xelatex")
				? "\nPDF export requires a LaTeX engine. Install TeX Live (brew install --cask mactex / apt install texlive) or set PANDOC_PDF_ENGINE to your preferred engine."
				: "";
			fail(new Error(`pandoc PDF export failed with exit code ${code}${stderr ? `: ${stderr}` : ""}${hint}`));
		});

		child.stdin.end(pandocInput);
	});
}

function isGeneratedDiffHighlightingBlock(lines: string[]): boolean {
	const body = lines.join("\n");
	const hasAdditionOrDeletion = /\\VariableTok\{\+|\\StringTok\{\{-\}/.test(body);
	const hasDiffStructure = /\\DataTypeTok\{@@|\\NormalTok\{diff \{-\}\{-\}git |\\KeywordTok\{\{-\}\{-\}\{-\}|\\DataTypeTok\{\+\+\+/.test(body);
	return hasAdditionOrDeletion && hasDiffStructure;
}

function decodeGeneratedLatexCodeText(text: string): string {
	return String(text ?? "")
		.replace(/\\textbackslash\{\}/g, "\\")
		.replace(/\\textasciigrave\{\}/g, "`")
		.replace(/\\textasciitilde\{\}/g, "~")
		.replace(/\\textasciicircum\{\}/g, "^")
		.replace(/\\\^\{\}/g, "^")
		.replace(/\\~\{\}/g, "~")
		.replace(/\\([{}_#$%&])/g, "$1");
}

function readVerbatimMathOperand(expr: string, startIndex: number): { operand: string; nextIndex: number } | null {
	if (startIndex >= expr.length) return null;
	const first = expr[startIndex]!;

	if (first === "{") {
		let depth = 1;
		let index = startIndex + 1;
		while (index < expr.length) {
			const char = expr[index]!;
			if (char === "{") {
				depth += 1;
			} else if (char === "}") {
				depth -= 1;
				if (depth === 0) {
					return {
						operand: expr.slice(startIndex + 1, index),
						nextIndex: index + 1,
					};
				}
			}
			index += 1;
		}
		return {
			operand: expr.slice(startIndex + 1),
			nextIndex: expr.length,
		};
	}

	if (first === "\\") {
		let index = startIndex + 1;
		while (index < expr.length && /[A-Za-z]/.test(expr[index]!)) {
			index += 1;
		}
		if (index === startIndex + 1 && index < expr.length) {
			index += 1;
		}
		return {
			operand: expr.slice(startIndex, index),
			nextIndex: index,
		};
	}

	return {
		operand: first,
		nextIndex: startIndex + 1,
	};
}

function makeHighlightingMathScriptsVerbatimSafe(text: string): string {
	const rewriteExpr = (expr: string): string => {
		let out = "";
		for (let index = 0; index < expr.length; index += 1) {
			const char = expr[index]!;
			if (char !== "_" && char !== "^") {
				out += char;
				continue;
			}

			const operand = readVerbatimMathOperand(expr, index + 1);
			if (!operand || !operand.operand) {
				out += char;
				continue;
			}

			out += char === "_" ? `\\sb{${operand.operand}}` : `\\sp{${operand.operand}}`;
			index = operand.nextIndex - 1;
		}
		return out;
	};

	return String(text ?? "")
		.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => `\\(${rewriteExpr(expr)}\\)`)
		.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => `\\[${rewriteExpr(expr)}\\]`)
		.replace(/\$\$([\s\S]*?)\$\$/g, (_match, expr: string) => `$$${rewriteExpr(expr)}$$`)
		.replace(/\$([^$\n]+?)\$/g, (_match, expr: string) => `$${rewriteExpr(expr)}$`);
}

function replaceAnnotationMarkersInDiffTokenLine(line: string, macroName: string): string {
	const tokenMatch = line.match(new RegExp(`^\\\\${macroName}\\{([\\s\\S]*)\\}$`));
	if (!tokenMatch) return line;

	const body = tokenMatch[1] ?? "";
	const wrapText = (text: string): string => text ? `\\${macroName}{${text}}` : "";
	const rewritten = replaceInlineAnnotationMarkers(
		body,
		(marker: { body: string }) => {
			const markerText = decodeGeneratedLatexCodeText(normalizeAnnotationText(marker.body));
			const cleaned = makeHighlightingMathScriptsVerbatimSafe(renderAnnotationPdfLatex(markerText));
			if (!cleaned) return "";
			return `\\piannotation{${cleaned}}`;
		},
		(segment: string) => wrapText(segment),
	);

	return rewritten === body ? line : (rewritten || wrapText(body));
}

function rewriteGeneratedDiffHighlighting(latex: string): string {
	const lines = String(latex ?? "").split("\n");
	const out: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (!/^\\begin\{Highlighting\}/.test(line)) {
			out.push(line);
			continue;
		}

		let closingIndex = -1;
		for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
			if (/^\\end\{Highlighting\}/.test(lines[innerIndex] ?? "")) {
				closingIndex = innerIndex;
				break;
			}
		}

		if (closingIndex === -1) {
			out.push(line);
			continue;
		}

		const blockLines = lines.slice(index, closingIndex + 1);
		if (!isGeneratedDiffHighlightingBlock(blockLines)) {
			out.push(...blockLines);
			index = closingIndex;
			continue;
		}

		const rewrittenBlock = blockLines.map((blockLine) => {
			if (/^\\VariableTok\{/.test(blockLine)) {
				return replaceAnnotationMarkersInDiffTokenLine(
					blockLine.replace(/^\\VariableTok\{/, "\\PiDiffAddTok{"),
					"PiDiffAddTok",
				);
			}
			if (/^\\StringTok\{/.test(blockLine)) {
				return replaceAnnotationMarkersInDiffTokenLine(
					blockLine.replace(/^\\StringTok\{/, "\\PiDiffDelTok{"),
					"PiDiffDelTok",
				);
			}
			if (/^\\DataTypeTok\{@@/.test(blockLine)) return blockLine.replace(/^\\DataTypeTok\{/, "\\PiDiffHunkTok{");
			if (/^\\DataTypeTok\{\+\+\+/.test(blockLine)) return blockLine.replace(/^\\DataTypeTok\{/, "\\PiDiffHeaderTok{");
			if (/^\\KeywordTok\{\{-\}\{-\}\{-\}/.test(blockLine)) return blockLine.replace(/^\\KeywordTok\{/, "\\PiDiffHeaderTok{");
			if (/^\\NormalTok\{(?:diff \{-\}\{-\}git |index |new file mode |deleted file mode |similarity index |rename from |rename to |Binary files )/.test(blockLine)) {
				return replaceAnnotationMarkersInDiffTokenLine(
					blockLine.replace(/^\\NormalTok\{/, "\\PiDiffMetaTok{"),
					"PiDiffMetaTok",
				);
			}
			return blockLine;
		});

		out.push(...rewrittenBlock);
		index = closingIndex;
	}

	return out.join("\n");
}

async function renderMarkdownToPdfViaGeneratedLatex(markdown: string, outputPath: string, resourcePath?: string): Promise<void> {
	const pandocCommand = process.env.PANDOC_PATH?.trim() || "pandoc";
	const pandocInput = normalizeMarkdownFencedBlocks(markdown);
	const preamblePath = await ensurePdfPreamble();
	const args = [
		"-f", "markdown+lists_without_preceding_blankline-blank_before_blockquote-blank_before_header+tex_math_dollars+autolink_bare_uris+superscript+subscript-raw_html",
		"-t", "latex",
		"-s",
		"-V", "geometry:margin=2.2cm",
		"-V", "fontsize=11pt",
		"-V", "linestretch=1.25",
		"-V", "urlcolor=blue",
		"-V", "linkcolor=blue",
		"--include-in-header", preamblePath,
	];
	if (resourcePath) args.push(`--resource-path=${resourcePath}`);

	const generatedLatex = await new Promise<string>((resolve, reject) => {
		const child = spawn(pandocCommand, args, { stdio: ["pipe", "pipe", "pipe"] });
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		let settled = false;

		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});
		child.stderr.on("data", (chunk: Buffer | string) => {
			stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});

		child.once("error", (error) => {
			const errno = error as NodeJS.ErrnoException;
			if (errno.code === "ENOENT") {
				fail(
					new Error(
						`pandoc was not found. Install pandoc or set PANDOC_PATH to the pandoc binary.`,
					),
				);
				return;
			}
			fail(error);
		});

		child.once("close", (code) => {
			if (settled) return;
			if (code === 0) {
				settled = true;
				resolve(Buffer.concat(stdoutChunks).toString("utf-8"));
				return;
			}
			const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
			fail(new Error(`pandoc LaTeX generation failed with exit code ${code}${stderr ? `: ${stderr}` : ""}`));
		});

		child.stdin.end(pandocInput);
	});

	await compileLatexToPdf(rewriteGeneratedDiffHighlighting(generatedLatex), outputPath, resourcePath);
}

class MermaidCliMissingError extends Error {}

interface MermaidPdfPreprocessResult {
	markdown: string;
	found: number;
	replaced: number;
	failed: number;
	missingCli: boolean;
}

function getMermaidPdfTheme(): "default" | "forest" | "dark" | "neutral" {
	const requested = process.env.MERMAID_PDF_THEME?.trim().toLowerCase();
	if (requested === "default" || requested === "forest" || requested === "dark" || requested === "neutral") {
		return requested;
	}
	return "default";
}

async function renderMermaidDiagramForPdf(source: string, outputPath: string): Promise<void> {
	const mermaidCommand = process.env.MERMAID_CLI_PATH?.trim() || "mmdc";
	const mermaidTheme = getMermaidPdfTheme();
	const tempDir = await mkdtemp(join(tmpdir(), "pi-markdown-preview-mermaid-"));
	const inputPath = join(tempDir, "diagram.mmd");

	await mkdir(dirname(outputPath), { recursive: true });

	try {
		await writeFile(inputPath, source, "utf-8");
		await new Promise<void>((resolve, reject) => {
			const args = ["-i", inputPath, "-o", outputPath, "-t", mermaidTheme, "-f"];
			const child = spawn(mermaidCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
			const stderrChunks: Buffer[] = [];
			let settled = false;

			const fail = (error: Error) => {
				if (settled) return;
				settled = true;
				reject(error);
			};

			child.stderr.on("data", (chunk: Buffer | string) => {
				stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
			});

			child.once("error", (error) => {
				const errno = error as NodeJS.ErrnoException;
				if (errno.code === "ENOENT") {
					fail(
						new MermaidCliMissingError(
							"Mermaid CLI (mmdc) not found. Install with `npm install -g @mermaid-js/mermaid-cli` or set MERMAID_CLI_PATH.",
						),
					);
					return;
				}
				fail(error);
			});

			child.once("close", (code) => {
				if (settled) return;
				settled = true;
				if (code === 0) {
					resolve();
					return;
				}
				const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
				reject(new Error(`Mermaid CLI failed with exit code ${code}${stderr ? `: ${stderr}` : ""}`));
			});
		});
	} finally {
		await rm(tempDir, { recursive: true, force: true }).catch(() => {});
	}
}

async function preprocessMermaidForPdf(markdown: string): Promise<MermaidPdfPreprocessResult> {
	const mermaidRegex = /```mermaid[^\n]*\n([\s\S]*?)```/gi;
	const matches: Array<{ start: number; end: number; raw: string; source: string; number: number }> = [];
	let match: RegExpExecArray | null;
	let blockNumber = 1;

	while ((match = mermaidRegex.exec(markdown)) !== null) {
		const raw = match[0]!;
		const source = (match[1] ?? "").trimEnd();
		matches.push({
			start: match.index,
			end: match.index + raw.length,
			raw,
			source,
			number: blockNumber++,
		});
	}

	if (matches.length === 0) {
		return {
			markdown,
			found: 0,
			replaced: 0,
			failed: 0,
			missingCli: false,
		};
	}

	await mkdir(MERMAID_PDF_CACHE_DIR, { recursive: true });

	const renderedBySource = new Map<string, string | null>();
	let missingCli = false;
	const mermaidTheme = getMermaidPdfTheme();

	for (const block of matches) {
		if (renderedBySource.has(block.source)) continue;

		const hash = createHash("sha256")
			.update(RENDER_VERSION)
			.update("\u0000")
			.update("pdf-mermaid")
			.update("\u0000")
			.update(mermaidTheme)
			.update("\u0000")
			.update(block.source)
			.digest("hex");
		const outputPath = join(MERMAID_PDF_CACHE_DIR, `${hash}.pdf`);

		if (existsSync(outputPath)) {
			renderedBySource.set(block.source, outputPath);
			continue;
		}

		if (missingCli) {
			renderedBySource.set(block.source, null);
			continue;
		}

		try {
			await renderMermaidDiagramForPdf(block.source, outputPath);
			renderedBySource.set(block.source, outputPath);
		} catch (error) {
			if (error instanceof MermaidCliMissingError) {
				missingCli = true;
			}
			renderedBySource.set(block.source, null);
		}
	}

	let transformed = "";
	let cursor = 0;
	let replaced = 0;
	let failed = 0;

	for (const block of matches) {
		transformed += markdown.slice(cursor, block.start);
		const renderedPath = renderedBySource.get(block.source) ?? null;
		if (renderedPath) {
			replaced++;
			const imageRef = pathToFileURL(renderedPath).href;
			transformed += `\n![Mermaid diagram ${block.number}](<${imageRef}>)\n`;
		} else {
			failed++;
			transformed += block.raw;
		}
		cursor = block.end;
	}

	transformed += markdown.slice(cursor);

	return {
		markdown: transformed,
		found: matches.length,
		replaced,
		failed,
		missingCli,
	};
}

async function exportPdf(ctx: ExtensionCommandContext, markdownOverride?: string, resourcePath?: string, isLatex?: boolean): Promise<void> {
	const markdown = markdownOverride ?? getLastAssistantMarkdown(ctx);
	if (!markdown) {
		ctx.ui.notify("No assistant markdown found in the current branch.", "warning");
		return;
	}

	const normalizedMarkdown = isLatex
		? markdown
		: normalizeSubSupTags(normalizeMarkdownFencedBlocks(normalizeObsidianImages(normalizeMathDelimiters(markdown))));
	const mermaidPrepared = isLatex ? { markdown: normalizedMarkdown, found: 0, replaced: 0, failed: 0, missingCli: false } : await preprocessMermaidForPdf(normalizedMarkdown);

	if (mermaidPrepared.missingCli) {
		ctx.ui.notify(
			"Mermaid CLI (mmdc) not found; Mermaid blocks are kept as code in PDF. Install @mermaid-js/mermaid-cli or set MERMAID_CLI_PATH.",
			"warning",
		);
	} else if (mermaidPrepared.failed > 0) {
		ctx.ui.notify(
			`Failed to render ${mermaidPrepared.failed} Mermaid block${mermaidPrepared.failed === 1 ? "" : "s"} for PDF. Unrendered blocks are kept as code.`,
			"warning",
		);
	}

	const markdownForPdf = isLatex ? mermaidPrepared.markdown : highlightAnnotationMarkersForPdf(mermaidPrepared.markdown);
	const hash = createHash("sha256")
		.update(RENDER_VERSION)
		.update("\u0000")
		.update("pdf")
		.update("\u0000")
		.update(markdownForPdf)
		.digest("hex");
	const pdfPath = join(CACHE_DIR, `${hash}.pdf`);

	await mkdir(CACHE_DIR, { recursive: true });
	if (isLatex) {
		await compileLatexToPdf(markdownForPdf, pdfPath, resourcePath);
	} else if (hasMarkdownDiffFence(markdownForPdf)) {
		await renderMarkdownToPdfViaGeneratedLatex(markdownForPdf, pdfPath, resourcePath);
	} else {
		await renderMarkdownToPdf(markdownForPdf, pdfPath, resourcePath);
	}
	await openFileInDefaultBrowser(pdfPath);
}

function buildBrowserHtmlFromPandocFragment(
	fragmentHtml: string,
	style: PreviewStyle,
	resourcePath?: string,
	annotationPlaceholders: PreviewAnnotationPlaceholder[] = [],
): string {
	const palette = style.palette;
	const baseTag = resourcePath ? `\n<base href="${pathToFileURL(resourcePath + "/").href}" />` : "";
	const annotationHelpersScript = ANNOTATION_HELPERS_SOURCE.replace(/<\/script/gi, "<\\/script");
	const annotationPlaceholdersJson = JSON.stringify(annotationPlaceholders).replace(/</g, "\\u003c");
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />${baseTag}
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Markdown Preview</title>
<style>
:root {
  --bg: ${palette.bg};
  --card: ${palette.card};
  --border: ${palette.border};
  --text: ${palette.text};
  --muted: ${palette.muted};
  --code-bg: ${palette.codeBg};
  --link: ${palette.link};
  --syntax-keyword: ${palette.syntaxKeyword};
  --syntax-function: ${palette.syntaxFunction};
  --syntax-variable: ${palette.syntaxVariable};
  --syntax-string: ${palette.syntaxString};
  --syntax-number: ${palette.syntaxNumber};
  --syntax-type: ${palette.syntaxType};
  --syntax-comment: ${palette.syntaxComment};
  --syntax-operator: ${palette.syntaxOperator};
  --syntax-punctuation: ${palette.syntaxPunctuation};
  --syntax-error: ${style.themeMode === "dark" ? "#ff7b72" : "#cf222e"};
  --annotation-bg: ${style.themeMode === "dark" ? "rgba(88, 166, 255, 0.22)" : "rgba(9, 105, 218, 0.14)"};
  --annotation-border: ${style.themeMode === "dark" ? "rgba(88, 166, 255, 0.62)" : "rgba(9, 105, 218, 0.40)"};
  --annotation-text: ${style.themeMode === "dark" ? "#e6edf3" : "#1f2328"};
  --diff-add-bg: ${style.themeMode === "dark" ? "rgba(46, 160, 67, 0.18)" : "rgba(26, 127, 55, 0.12)"};
  --diff-add-text: ${style.themeMode === "dark" ? "#3fb950" : "#1a7f37"};
  --diff-del-bg: ${style.themeMode === "dark" ? "rgba(248, 81, 73, 0.18)" : "rgba(207, 34, 46, 0.12)"};
  --diff-del-text: ${style.themeMode === "dark" ? "#ff7b72" : "#cf222e"};
  --diff-meta-text: ${style.themeMode === "dark" ? "#9da7b5" : "#57606a"};
  --diff-header-bg: ${style.themeMode === "dark" ? "rgba(88, 166, 255, 0.10)" : "rgba(9, 105, 218, 0.08)"};
  --diff-header-text: ${style.themeMode === "dark" ? "#79c0ff" : "#0969da"};
  --diff-hunk-bg: ${style.themeMode === "dark" ? "rgba(88, 166, 255, 0.16)" : "rgba(9, 105, 218, 0.12)"};
  --diff-hunk-text: ${style.themeMode === "dark" ? "#79c0ff" : "#0969da"};
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
}
body {
  min-height: 100vh;
  padding: 28px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
#preview-root {
  width: min(1100px, 100%);
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px 28px;
  overflow-wrap: anywhere;
  line-height: 1.58;
  font-size: 16px;
}
#preview-root h1, #preview-root h2, #preview-root h3, #preview-root h4, #preview-root h5, #preview-root h6 {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  line-height: 1.25;
}
#preview-root h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
#preview-root h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.25em; }
#preview-root p, #preview-root ul, #preview-root ol, #preview-root blockquote, #preview-root table {
  margin-top: 0;
  margin-bottom: 1em;
}
#preview-root a { color: var(--link); text-decoration: none; }
#preview-root a:hover { text-decoration: underline; }
#preview-root blockquote {
  margin-left: 0;
  padding: 0 1em;
  border-left: 0.25em solid var(--border);
  color: var(--muted);
}
#preview-root pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  overflow: auto;
}
#preview-root code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9em;
}
#preview-root :not(pre) > code {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.12em 0.35em;
}
#preview-root .annotation-marker {
  display: inline;
  border-radius: 4px;
  border: 1px solid var(--annotation-border);
  background: var(--annotation-bg);
  color: var(--annotation-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  padding: 0 0.28em;
}
#preview-root .annotation-marker mjx-container {
  margin: 0;
}
#preview-root pre.sourceCode.diff code > .diff-line {
  display: block;
  margin: 0 -4px;
  padding: 0 4px;
  border-radius: 4px;
}
#preview-root pre.sourceCode.diff code > .diff-add-line {
  background: var(--diff-add-bg);
  color: var(--diff-add-text);
}
#preview-root pre.sourceCode.diff code > .diff-del-line {
  background: var(--diff-del-bg);
  color: var(--diff-del-text);
}
#preview-root pre.sourceCode.diff code > .diff-meta-line {
  color: var(--diff-meta-text);
}
#preview-root pre.sourceCode.diff code > .diff-header-line {
  background: var(--diff-header-bg);
  color: var(--diff-header-text);
  font-weight: 600;
}
#preview-root pre.sourceCode.diff code > .diff-hunk-line {
  background: var(--diff-hunk-bg);
  color: var(--diff-hunk-text);
}
#preview-root pre.sourceCode.diff code > .diff-line .kw,
#preview-root pre.sourceCode.diff code > .diff-line .dt,
#preview-root pre.sourceCode.diff code > .diff-line .st,
#preview-root pre.sourceCode.diff code > .diff-line .va {
  color: inherit;
  font-weight: inherit;
}
#preview-root code span.kw,
#preview-root code span.cf,
#preview-root code span.im {
  color: var(--syntax-keyword);
  font-weight: 600;
}
#preview-root code span.dt {
  color: var(--syntax-type);
  font-weight: 600;
}
#preview-root code span.fu,
#preview-root code span.bu {
  color: var(--syntax-function);
}
#preview-root code span.va,
#preview-root code span.ot {
  color: var(--syntax-variable);
}
#preview-root code span.st,
#preview-root code span.ss,
#preview-root code span.sc,
#preview-root code span.ch {
  color: var(--syntax-string);
}
#preview-root code span.dv,
#preview-root code span.bn,
#preview-root code span.fl {
  color: var(--syntax-number);
}
#preview-root code span.co {
  color: var(--syntax-comment);
  font-style: italic;
}
#preview-root code span.op {
  color: var(--syntax-operator);
}
#preview-root code span.er,
#preview-root code span.al {
  color: var(--syntax-error);
  font-weight: 600;
}
#preview-root table {
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow: auto;
}
#preview-root th, #preview-root td {
  border: 1px solid var(--border);
  padding: 6px 12px;
}
#preview-root hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 1.25em 0;
}
#preview-root img { max-width: 100%; }
#preview-root math[display="block"] {
  display: block;
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
#preview-root mjx-container[display="true"] {
  display: block;
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
#preview-root .mermaid-container {
  text-align: center;
  margin: 1em 0;
  overflow-x: auto;
}
#preview-root .mermaid-container svg {
  max-width: 100%;
  height: auto;
}
</style>
</head>
<body>
  <article id="preview-root">${fragmentHtml}</article>
  <script>
${annotationHelpersScript}
  </script>
  <script type="module">
  (async () => {
    const annotationHelpers = window.PiMarkdownPreviewAnnotationHelpers || null;
    const previewAnnotationPlaceholders = ${annotationPlaceholdersJson};
    const DIFF_META_LINE_REGEX = /^(diff --git |index |new file mode |deleted file mode |similarity index |rename from |rename to |Binary files )/;

    const escapeRegExp = (text) => {
      const backslash = String.fromCharCode(92);
      const specials = '.+*?^' + '$' + '{}|[]' + backslash;
      return Array.from(String(text || '')).map((ch) => specials.includes(ch) ? backslash + ch : ch).join('');
    };

    const setAnnotationMarkerContent = (marker, text) => {
      if (!(marker instanceof HTMLElement)) return;
      const rendered = annotationHelpers && typeof annotationHelpers.renderPreviewAnnotationHtml === 'function'
        ? annotationHelpers.renderPreviewAnnotationHtml(text)
        : String(text || '');
      marker.innerHTML = rendered;
    };

    const replaceAnnotationTextNode = (textNode) => {
      if (!annotationHelpers || typeof annotationHelpers.collectInlineAnnotationMarkers !== 'function') return;
      const text = typeof textNode.nodeValue === 'string' ? textNode.nodeValue : '';
      if (!text || text.toLowerCase().indexOf('[an:') === -1) return;

      const markers = annotationHelpers.collectInlineAnnotationMarkers(text);
      if (!Array.isArray(markers) || markers.length === 0) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      markers.forEach((markerInfo) => {
        const token = markerInfo && typeof markerInfo.raw === 'string' ? markerInfo.raw : '';
        const start = markerInfo && typeof markerInfo.start === 'number' ? markerInfo.start : lastIndex;
        const end = markerInfo && typeof markerInfo.end === 'number' ? markerInfo.end : start;
        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        const markerText = annotationHelpers && typeof annotationHelpers.normalizePreviewAnnotationLabel === 'function'
          ? annotationHelpers.normalizePreviewAnnotationLabel(markerInfo.body)
          : String(markerInfo && markerInfo.body || '').trim();
        if (markerText) {
          const markerEl = document.createElement('span');
          markerEl.className = 'annotation-marker';
          markerEl.title = token || markerText;
          setAnnotationMarkerContent(markerEl, markerText);
          fragment.appendChild(markerEl);
        }

        lastIndex = end;
      });

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    };

    const applyPreviewAnnotationPlaceholders = (root) => {
      if (!root || !Array.isArray(previewAnnotationPlaceholders) || previewAnnotationPlaceholders.length === 0) return;
      const placeholderMap = new Map();
      const placeholderTokens = [];
      previewAnnotationPlaceholders.forEach((entry) => {
        const token = entry && typeof entry.token === 'string' ? entry.token : '';
        if (!token) return;
        placeholderMap.set(token, entry);
        placeholderTokens.push(token);
      });
      if (placeholderTokens.length === 0) return;

      const placeholderPattern = new RegExp(placeholderTokens.map(escapeRegExp).join('|'), 'g');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node = walker.nextNode();
      while (node) {
        const textNode = node;
        const value = typeof textNode.nodeValue === 'string' ? textNode.nodeValue : '';
        if (value && value.indexOf('${PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX}') !== -1) {
          const parent = textNode.parentElement;
          const tag = parent && parent.tagName ? parent.tagName.toUpperCase() : '';
          if (tag !== 'CODE' && tag !== 'PRE' && tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'TEXTAREA') {
            textNodes.push(textNode);
          }
        }
        node = walker.nextNode();
      }

      textNodes.forEach((textNode) => {
        const text = typeof textNode.nodeValue === 'string' ? textNode.nodeValue : '';
        if (!text) return;
        placeholderPattern.lastIndex = 0;
        if (!placeholderPattern.test(text)) return;
        placeholderPattern.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = placeholderPattern.exec(text)) !== null) {
          const token = match[0] || '';
          const entry = placeholderMap.get(token);
          const start = typeof match.index === 'number' ? match.index : 0;
          if (start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
          }
          if (entry) {
            const markerEl = document.createElement('span');
            markerEl.className = 'annotation-marker';
            const markerText = typeof entry.text === 'string' ? entry.text : token;
            markerEl.title = typeof entry.title === 'string' ? entry.title : markerText;
            setAnnotationMarkerContent(markerEl, markerText);
            fragment.appendChild(markerEl);
          } else {
            fragment.appendChild(document.createTextNode(token));
          }
          lastIndex = start + token.length;
          if (token.length === 0) {
            placeholderPattern.lastIndex += 1;
          }
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      });
    };

    const decorateDiffCodeBlocks = (root) => {
      if (!root) return;
      const diffBlocks = Array.from(root.querySelectorAll('pre.sourceCode.diff code'));

      diffBlocks.forEach((codeBlock) => {
        const lineElements = Array.from(codeBlock.children).filter((child) => child instanceof HTMLElement);
        lineElements.forEach((lineEl) => {
          const text = typeof lineEl.textContent === 'string' ? lineEl.textContent : '';
          if (!text) return;

          if (/^\\+(?!\\+\\+)/.test(text)) {
            lineEl.classList.add('diff-line', 'diff-add-line');
          } else if (/^-(?!--)/.test(text)) {
            lineEl.classList.add('diff-line', 'diff-del-line');
          } else if (/^@@/.test(text)) {
            lineEl.classList.add('diff-line', 'diff-hunk-line');
          } else if (/^(?:\\+\\+\\+ |--- )/.test(text)) {
            lineEl.classList.add('diff-line', 'diff-header-line');
          } else if (DIFF_META_LINE_REGEX.test(text)) {
            lineEl.classList.add('diff-line', 'diff-meta-line');
          }

          const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
          const matches = [];
          let node = walker.nextNode();
          while (node) {
            const textNode = node;
            const value = typeof textNode.nodeValue === 'string' ? textNode.nodeValue : '';
            const parent = textNode.parentElement;
            if (value && value.toLowerCase().indexOf('[an:') !== -1 && parent && !parent.closest('a, .annotation-marker')) {
              matches.push(textNode);
            }
            node = walker.nextNode();
          }

          matches.forEach(replaceAnnotationTextNode);
        });
      });
    };

    const MATHJAX_CDN_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';

    const waitForFonts = async () => {
      if ('fonts' in document) {
        try {
          await document.fonts.ready;
        } catch {}
      }
    };

    const waitForPaint = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    const extractMathFallbackTex = (text, displayMode) => {
      const source = typeof text === 'string' ? text.trim() : '';
      if (!source) return '';

      if (displayMode) {
        if (source.startsWith('$$') && source.endsWith('$$') && source.length >= 4) {
          return source.slice(2, -2).trim();
        }
        if (source.startsWith('\\\\[') && source.endsWith('\\\\]') && source.length >= 4) {
          return source.slice(2, -2).trim();
        }
        return source;
      }

      if (source.startsWith('\\\\(') && source.endsWith('\\\\)') && source.length >= 4) {
        return source.slice(2, -2).trim();
      }
      if (source.startsWith('$') && source.endsWith('$') && source.length >= 2) {
        return source.slice(1, -1).trim();
      }
      return source;
    };

    const collectMathFallbackTargets = (root) => {
      if (!root) return [];
      const nodes = Array.from(root.querySelectorAll('.math.display, .math.inline'));
      const targets = [];
      const seenTargets = new Set();

      nodes.forEach((node) => {
        const displayMode = node.classList.contains('display');
        const rawText = typeof node.textContent === 'string' ? node.textContent : '';
        const tex = extractMathFallbackTex(rawText, displayMode);
        if (!tex) return;

        let renderTarget = node;
        if (displayMode) {
          const parent = node.parentElement;
          const parentText = parent && typeof parent.textContent === 'string' ? parent.textContent.trim() : '';
          if (parent && parent.tagName === 'P' && parentText === rawText.trim()) {
            renderTarget = parent;
          }
        }

        if (seenTargets.has(renderTarget)) return;
        seenTargets.add(renderTarget);
        targets.push({ renderTarget, displayMode, tex });
      });

      return targets;
    };

    let mathJaxPromise = null;
    const ensureMathJax = () => {
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        return Promise.resolve(window.MathJax);
      }
      if (mathJaxPromise) return mathJaxPromise;

      mathJaxPromise = new Promise((resolve, reject) => {
        window.MathJax = {
          loader: { load: ['[tex]/ams', '[tex]/noerrors', '[tex]/noundefined'] },
          tex: {
            inlineMath: [['\\\\(', '\\\\)'], ['$', '$']],
            displayMath: [['\\\\[', '\\\\]'], ['$$', '$$']],
            packages: { '[+]': ['ams', 'noerrors', 'noundefined'] },
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          },
          startup: { typeset: false },
        };

        const script = document.createElement('script');
        script.src = MATHJAX_CDN_URL;
        script.async = true;
        script.onload = () => {
          const api = window.MathJax;
          if (api && api.startup && api.startup.promise && typeof api.startup.promise.then === 'function') {
            api.startup.promise.then(() => resolve(api)).catch(reject);
            return;
          }
          if (api && typeof api.typesetPromise === 'function') {
            resolve(api);
            return;
          }
          reject(new Error('MathJax did not initialize.'));
        };
        script.onerror = () => reject(new Error('Failed to load MathJax.'));
        document.head.appendChild(script);
      }).catch((error) => {
        mathJaxPromise = null;
        throw error;
      });

      return mathJaxPromise;
    };

    const markerNeedsMath = (text) => {
      const source = typeof text === 'string' ? text : '';
      if (!source) return false;
      const backslash = String.fromCharCode(92);
      if (source.includes(backslash + '(') || source.includes(backslash + '[') || source.includes('$$')) return true;
      for (let index = 0; index < source.length - 1; index += 1) {
        const char = source[index];
        const next = source[index + 1] || '';
        if (char === '$' && next.trim() !== '') return true;
        if (char === backslash && /[A-Za-z]/.test(next)) return true;
      }
      return false;
    };

    const renderAnnotationMarkerMath = async (root) => {
      if (!root) return;
      const markers = Array.from(root.querySelectorAll('.annotation-marker')).filter((marker) => {
        if (!(marker instanceof HTMLElement)) return false;
        if (marker.querySelector('math, mjx-container')) return false;
        const text = typeof marker.textContent === 'string' ? marker.textContent : '';
        return markerNeedsMath(text);
      });
      if (markers.length === 0) return;

      let mathJax;
      try {
        mathJax = await ensureMathJax();
      } catch (e) {
        console.error('MathJax load failed:', e);
        return;
      }

      try {
        await mathJax.typesetPromise(markers);
      } catch (e) {
        console.error('Annotation math render failed:', e);
      }
    };

    const renderMathFallback = async (root) => {
      const fallbackTargets = collectMathFallbackTargets(root);
      if (fallbackTargets.length === 0) return;

      let mathJax;
      try {
        mathJax = await ensureMathJax();
      } catch (e) {
        console.error('MathJax load failed:', e);
        return;
      }

      fallbackTargets.forEach(({ renderTarget, displayMode, tex }) => {
        renderTarget.textContent = displayMode ? '\\\\[\\n' + tex + '\\n\\\\]' : '\\\\(' + tex + '\\\\)';
      });

      try {
        await mathJax.typesetPromise(fallbackTargets.map(({ renderTarget }) => renderTarget));
      } catch (e) {
        console.error('MathJax render failed:', e);
      }
    };

    const renderMermaid = async () => {
      const mermaidBlocks = document.querySelectorAll('pre.mermaid');
      if (mermaidBlocks.length === 0) return;

      try {
        const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
        mermaid.initialize({
          startOnLoad: false,
          theme: '${style.themeMode === "dark" ? "dark" : "default"}',
        });
        mermaidBlocks.forEach(pre => {
          const code = pre.querySelector('code');
          const src = code ? code.textContent : pre.textContent;
          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-container';
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = src;
          wrapper.appendChild(div);
          pre.replaceWith(wrapper);
        });
        await mermaid.run();
      } catch (e) {
        console.error('Mermaid render failed:', e);
      }
    };

    const root = document.getElementById('preview-root');
    try {
      await renderMermaid();
      applyPreviewAnnotationPlaceholders(root);
      decorateDiffCodeBlocks(root);
      await renderAnnotationMarkerMath(root);
      await renderMathFallback(root);
      await waitForFonts();
      await waitForPaint();
    } finally {
      window.__mermaidDone = true;
    }
  })();
  </script>
</body>
</html>`;
}

async function openPreviewInBrowser(ctx: ExtensionCommandContext, markdownOverride?: string, resourcePath?: string, isLatex?: boolean): Promise<void> {
	const markdown = markdownOverride ?? getLastAssistantMarkdown(ctx);
	if (!markdown) {
		throw new Error("No assistant markdown found in the current branch.");
	}

	const style = getPreviewStyle(ctx.ui.theme);
	const { normalizedMarkdown, pandocMarkdown, annotationPlaceholders } = prepareBrowserPreviewMarkdown(markdown, isLatex);
	const fragmentHtml = await renderMarkdownToHtmlWithPandoc(pandocMarkdown, resourcePath, isLatex);
	const html = buildBrowserHtmlFromPandocFragment(fragmentHtml, style, resourcePath, annotationPlaceholders);
	const hash = createHash("sha256")
		.update(RENDER_VERSION)
		.update("\u0000")
		.update("browser-native")
		.update("\u0000")
		.update(style.cacheKey)
		.update("\u0000")
		.update(normalizedMarkdown)
		.digest("hex");
	const htmlPath = join(CACHE_DIR, `${hash}.html`);

	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(htmlPath, html, "utf-8");
	await openFileInDefaultBrowser(htmlPath);
}

function tokenizeArgs(input: string): string[] {
	const tokens: string[] = [];
	const s = input.trim();
	let i = 0;

	while (i < s.length) {
		while (i < s.length && /\s/.test(s[i]!)) i++;
		if (i >= s.length) break;

		const ch = s[i]!;
		if (ch === '"' || ch === "'") {
			const quote = ch;
			i++;
			let token = "";
			while (i < s.length && s[i] !== quote) {
				token += s[i];
				i++;
			}
			if (i < s.length) i++; // skip closing quote
			tokens.push(token);
		} else {
			let token = "";
			while (i < s.length && !/\s/.test(s[i]!)) {
				token += s[i];
				i++;
			}
			tokens.push(token);
		}
	}

	return tokens;
}

function parsePreviewArgs(args: string): { target?: PreviewTarget; pick?: boolean; file?: string; help?: boolean; error?: string } {
	const tokens = tokenizeArgs(args);
	let target: PreviewTarget = "terminal";
	let explicitTarget = false;
	let pick = false;
	let file: string | undefined;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]!;

		if (token === "--help" || token === "-h" || token === "help") {
			return { help: true };
		}

		if (token === "--pick" || token === "pick" || token === "-p") {
			pick = true;
			continue;
		}

		if (token === "--file" || token === "-f") {
			const next = tokens[i + 1];
			if (!next || next.startsWith("-")) {
				return { error: "Missing file path after --file." };
			}
			file = next;
			i++;
			continue;
		}

		if (
			token === "--browser" ||
			token === "browser" ||
			token === "--external" ||
			token === "external" ||
			token === "--browser-native" ||
			token === "native"
		) {
			if (explicitTarget && target !== "browser") {
				return { error: "Conflicting output targets. Choose one of terminal, browser, or pdf." };
			}
			target = "browser";
			explicitTarget = true;
			continue;
		}

		if (token === "--pdf" || token === "pdf") {
			if (explicitTarget && target !== "pdf") {
				return { error: "Conflicting output targets. Choose one of terminal, browser, or pdf." };
			}
			target = "pdf";
			explicitTarget = true;
			continue;
		}

		if (token === "--terminal" || token === "terminal") {
			if (explicitTarget && target !== "terminal") {
				return { error: "Conflicting output targets. Choose one of terminal, browser, or pdf." };
			}
			target = "terminal";
			explicitTarget = true;
			continue;
		}

		if (token.startsWith("--engine") || token.startsWith("-engine")) {
			return { error: "Engine selection was removed. Use /preview or /preview --browser." };
		}

		// Treat bare argument as a file path if no --file flag was used
		if (!file && !token.startsWith("-")) {
			file = token;
			continue;
		}

		return { error: `Unknown argument \"${token}\". Use /preview [--pick|-p] [--file|-f <path>] [--browser] [--pdf] [--terminal]` };
	}

	if (file && pick) {
		return { error: "Cannot use --pick and --file together." };
	}

	return { target, pick, file };
}

export default function (pi: ExtensionAPI) {
	const run = async (args: string, ctx: ExtensionCommandContext) => {
		const parsed = parsePreviewArgs(args);
		if (parsed.help) {
			ctx.ui.notify("Usage: /preview [--pick|-p] [--file|-f <path>] [--browser] [--pdf] [--terminal]  or  /preview <path>", "info");
			return;
		}
		if (parsed.error || !parsed.target) {
			ctx.ui.notify(parsed.error ?? "Invalid preview arguments.", "error");
			return;
		}

		await ctx.waitForIdle();

		let markdown: string | undefined;
		let resourcePath: string | undefined;
		let isLatex = false;
		if (parsed.file) {
			try {
				const expanded = parsed.file.startsWith("~/") ? join(homedir(), parsed.file.slice(2))
					: parsed.file === "~" ? homedir()
					: parsed.file;
				const filePath = resolvePath(ctx.cwd, expanded);
				const fileContent = await readFile(filePath, "utf-8");
				resourcePath = dirname(filePath);
				if (isLatexFile(filePath)) {
					markdown = fileContent;
					isLatex = true;
				} else if (isMarkdownFile(filePath)) {
					markdown = fileContent;
				} else {
					const lang = detectLanguageFromPath(filePath);
					markdown = wrapCodeAsMarkdown(fileContent, lang, filePath);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to read file: ${message}`, "error");
				return;
			}
		} else if (parsed.pick) {
			const picked = await pickAssistantMessage(ctx);
			if (picked === null) return;
			markdown = picked;
		}

		const effectiveMarkdown = markdown ?? getLastAssistantMarkdown(ctx);
		if (!resourcePath && effectiveMarkdown && hasLikelyRelativeLocalImages(effectiveMarkdown)) {
			ctx.ui.notify(
				"Relative local image paths may not resolve for assistant-response previews. Use /preview --file <path> for reliable local image loading.",
				"warning",
			);
		}

		if (parsed.target === "browser") {
			try {
				await openPreviewInBrowser(ctx, markdown, resourcePath, isLatex);
				ctx.ui.notify("Opened preview in browser.", "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Browser preview failed: ${message}`, "error");
			}
			return;
		}

		if (parsed.target === "pdf") {
			try {
				await exportPdf(ctx, markdown, resourcePath, isLatex);
				ctx.ui.notify("Opened PDF preview.", "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`PDF export failed: ${message}`, "error");
			}
			return;
		}

		await openPreview(ctx, markdown, resourcePath, isLatex);
	};

	pi.registerCommand("preview", {
		description: "Rendered markdown preview (--pick select response, --file <path> or bare path, --browser for HTML, --pdf for PDF, --terminal to force inline)",
		handler: run,
	});

	pi.registerCommand("preview-browser", {
		description: "Open rendered markdown + LaTeX preview in the default browser (MathML + selective MathJax fallback)",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();
			await run(`--browser ${args}`.trim(), ctx);
		},
	});

	pi.registerCommand("preview-pdf", {
		description: "Export markdown to PDF via pandoc + LaTeX and open it",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();
			// Re-use the main run handler with --pdf prepended
			await run(`--pdf ${args}`.trim(), ctx);
		},
	});

	pi.registerCommand("preview-clear-cache", {
		description: "Clear rendered preview cache (~/.pi/cache/markdown-preview)",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();
			try {
				await rm(CACHE_DIR, { recursive: true, force: true });
				ctx.ui.notify(`Cleared preview cache: ${CACHE_DIR}`, "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to clear preview cache: ${message}`, "error");
			}
		},
	});

	// -------------------------------------------------------------------------
	// Cross-extension preview protocol: listen for "ck:preview-request" messages
	// dispatched by CaveKit's /ck:preview command.
	// -------------------------------------------------------------------------
	pi.on("message_start", async (event, ctx) => {
		if (!ctx.hasUI) return;
		const msg = event.message as any;
		if (msg.role !== "custom" || msg.customType !== "ck:preview-request") return;

		const { filePath, target } = msg.details ?? {};
		if (!filePath || typeof filePath !== "string") return;

		try {
			const fileContent = await readFile(filePath, "utf-8");
			const resourcePath = dirname(filePath);
			let markdown: string;
			let isLatex = false;

			if (isLatexFile(filePath)) {
				markdown = fileContent;
				isLatex = true;
			} else if (isMarkdownFile(filePath)) {
				markdown = fileContent;
			} else {
				const lang = detectLanguageFromPath(filePath);
				markdown = wrapCodeAsMarkdown(fileContent, lang, filePath);
			}

			// Cast ExtensionContext to ExtensionCommandContext — file preview only
			// uses ctx.ui and ctx.cwd which are on the base ExtensionContext.
			const cmdCtx = ctx as unknown as ExtensionCommandContext;

			if (target === "browser") {
				await openPreviewInBrowser(cmdCtx, markdown, resourcePath, isLatex);
			} else if (target === "pdf") {
				await exportPdf(cmdCtx, markdown, resourcePath, isLatex);
			} else {
				await openPreview(cmdCtx, markdown, resourcePath, isLatex);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Preview failed: ${message}`, "error");
		}
	});
}
