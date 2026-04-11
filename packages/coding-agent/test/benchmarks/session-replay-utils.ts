/**
 * Session Replay Utilities
 *
 * Parses real .jsonl session files and computes what-if compression savings.
 * Extracts tool results, assistant usage data, and simulates compression.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AssistantMessage, TextContent, ToolResultMessage, Usage } from "@cave/ai";
import {
	ReadDeduplicationCache,
	compressCaveToolOutput,
	truncateWithToolBudget,
} from "../../src/core/cave-tool-compression.js";
import { compressStructuredOutput } from "../../src/core/cave-structured-compression.js";
import { buildCaveModePrompt } from "../../src/core/system-prompt.js";
import type { FileEntry, SessionHeader, SessionMessageEntry } from "../../src/core/session-manager.js";

// ============================================================================
// Types
// ============================================================================

export interface ToolResultEntry {
	toolName: string;
	toolCallId: string;
	content: string;
	charCount: number;
	estimatedTokens: number;
	isError: boolean;
	timestamp: number;
}

export interface AssistantUsageEntry {
	model: string;
	usage: Usage;
	timestamp: number;
}

export interface SessionData {
	id: string;
	filePath: string;
	cwd: string;
	timestamp: string;
	toolResults: ToolResultEntry[];
	assistantUsages: AssistantUsageEntry[];
	totalAssistantMessages: number;
	totalUserMessages: number;
}

export interface CompressionReport {
	sessionId: string;
	originalTotalChars: number;
	compressedTotalChars: number;
	originalTotalTokens: number;
	compressedTotalTokens: number;
	savingsChars: number;
	savingsTokens: number;
	savingsPercent: number;
	perTool: Record<string, { original: number; compressed: number; savings: number; count: number }>;
}

export interface DedupReport {
	sessionId: string;
	totalReads: number;
	uniqueFiles: number;
	dedupHits: number;
	originalTokens: number;
	dedupedTokens: number;
	savingsTokens: number;
	savingsPercent: number;
}

export interface WhatIfReport {
	session: SessionData;
	compression: CompressionReport;
	dedup: DedupReport;
	promptOverhead: Record<string, number>;
	netSavings: Record<string, number>;
}

// ============================================================================
// Parsing
// ============================================================================

function estimateTokens(chars: number): number {
	return Math.ceil(chars / 4);
}

function parseEntries(filePath: string): FileEntry[] {
	const content = readFileSync(filePath, "utf8");
	const entries: FileEntry[] = [];

	for (const line of content.trim().split("\n")) {
		if (!line.trim()) continue;
		try {
			entries.push(JSON.parse(line) as FileEntry);
		} catch {
			// Skip malformed
		}
	}

	return entries;
}

function extractTextFromContent(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return (content as Array<{ type: string; text?: string }>)
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text!)
		.join("\n");
}

// ============================================================================
// Session Loading
// ============================================================================

export function discoverSessionDirs(sessionsBase: string): string[] {
	if (!existsSync(sessionsBase)) return [];

	const dirs: string[] = [];
	for (const entry of readdirSync(sessionsBase)) {
		const fullPath = join(sessionsBase, entry);
		try {
			if (statSync(fullPath).isDirectory()) {
				dirs.push(fullPath);
			}
		} catch {
			// Skip inaccessible
		}
	}
	return dirs;
}

export function discoverSessionFiles(sessionsBase: string, limit = 50): string[] {
	const dirs = discoverSessionDirs(sessionsBase);
	const allFiles: { path: string; mtime: number }[] = [];

	for (const dir of dirs) {
		try {
			const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
			for (const file of files) {
				const fullPath = join(dir, file);
				try {
					const st = statSync(fullPath);
					allFiles.push({ path: fullPath, mtime: st.mtimeMs });
				} catch {
					// Skip
				}
			}
		} catch {
			// Skip inaccessible dirs
		}
	}

	// Sort by most recent first, take limit
	allFiles.sort((a, b) => b.mtime - a.mtime);
	return allFiles.slice(0, limit).map((f) => f.path);
}

export function loadSession(filePath: string): SessionData | null {
	const entries = parseEntries(filePath);
	if (entries.length === 0) return null;

	const header = entries[0] as SessionHeader;
	if (header.type !== "session") return null;

	const toolResults: ToolResultEntry[] = [];
	const assistantUsages: AssistantUsageEntry[] = [];
	let totalAssistantMessages = 0;
	let totalUserMessages = 0;

	for (const entry of entries) {
		if (!("message" in entry)) continue;
		const msgEntry = entry as SessionMessageEntry;
		const msg = msgEntry.message;

		if (msg.role === "user") {
			totalUserMessages++;
		} else if (msg.role === "assistant") {
			totalAssistantMessages++;
			const assistant = msg as AssistantMessage;
			if (assistant.usage) {
				assistantUsages.push({
					model: assistant.model ?? "unknown",
					usage: assistant.usage,
					timestamp: assistant.timestamp ?? 0,
				});
			}
		} else if (msg.role === "toolResult") {
			const toolResult = msg as ToolResultMessage;
			const text = extractTextFromContent(toolResult.content);
			if (text.length > 0) {
				toolResults.push({
					toolName: toolResult.toolName,
					toolCallId: toolResult.toolCallId,
					content: text,
					charCount: text.length,
					estimatedTokens: estimateTokens(text.length),
					isError: toolResult.isError,
					timestamp: toolResult.timestamp ?? 0,
				});
			}
		}
	}

	return {
		id: header.id,
		filePath,
		cwd: header.cwd ?? "unknown",
		timestamp: header.timestamp ?? "unknown",
		toolResults,
		assistantUsages,
		totalAssistantMessages,
		totalUserMessages,
	};
}

// ============================================================================
// Compression Simulation
// ============================================================================

export function simulateCompression(toolResults: ToolResultEntry[]): CompressionReport {
	const perTool: Record<string, { original: number; compressed: number; savings: number; count: number }> = {};

	let totalOriginal = 0;
	let totalCompressed = 0;

	for (const tr of toolResults) {
		const originalChars = tr.charCount;

		// Apply full compression pipeline
		const afterBudget = truncateWithToolBudget(tr.content, tr.toolName);
		const afterStructured = compressStructuredOutput(afterBudget, tr.toolName);
		const final = compressCaveToolOutput(afterStructured);
		const compressedChars = final.length;

		totalOriginal += originalChars;
		totalCompressed += compressedChars;

		if (!perTool[tr.toolName]) {
			perTool[tr.toolName] = { original: 0, compressed: 0, savings: 0, count: 0 };
		}
		perTool[tr.toolName]!.original += originalChars;
		perTool[tr.toolName]!.compressed += compressedChars;
		perTool[tr.toolName]!.savings += originalChars - compressedChars;
		perTool[tr.toolName]!.count++;
	}

	const savingsChars = totalOriginal - totalCompressed;

	return {
		sessionId: "",
		originalTotalChars: totalOriginal,
		compressedTotalChars: totalCompressed,
		originalTotalTokens: estimateTokens(totalOriginal),
		compressedTotalTokens: estimateTokens(totalCompressed),
		savingsChars,
		savingsTokens: estimateTokens(savingsChars),
		savingsPercent: totalOriginal > 0 ? (savingsChars / totalOriginal) * 100 : 0,
		perTool,
	};
}

export function simulateDedup(toolResults: ToolResultEntry[]): DedupReport {
	const cache = new ReadDeduplicationCache();
	const readResults = toolResults.filter((tr) => tr.toolName === "read");

	let totalOriginalTokens = 0;
	let totalDedupedTokens = 0;
	let dedupHits = 0;
	const uniqueFiles = new Set<string>();

	for (const tr of readResults) {
		// Use toolCallId as a proxy for file path (actual path not in ToolResultMessage)
		// In real sessions, we'd need to look at the preceding tool call args
		// For now, use content fingerprint as path key
		const fakePath = `file-${tr.content.length}-${tr.content.slice(0, 50)}`;
		uniqueFiles.add(fakePath);

		const originalTokens = tr.estimatedTokens;
		totalOriginalTokens += originalTokens;

		const stub = cache.checkRead(fakePath, tr.content);
		if (stub) {
			dedupHits++;
			totalDedupedTokens += estimateTokens(stub.length);
		} else {
			totalDedupedTokens += originalTokens;
		}
	}

	const savingsTokens = totalOriginalTokens - totalDedupedTokens;

	return {
		sessionId: "",
		totalReads: readResults.length,
		uniqueFiles: uniqueFiles.size,
		dedupHits,
		originalTokens: totalOriginalTokens,
		dedupedTokens: totalDedupedTokens,
		savingsTokens,
		savingsPercent: totalOriginalTokens > 0 ? (savingsTokens / totalOriginalTokens) * 100 : 0,
	};
}

export function calculateWhatIfSavings(session: SessionData): WhatIfReport {
	const compression = simulateCompression(session.toolResults);
	compression.sessionId = session.id;

	const dedup = simulateDedup(session.toolResults);
	dedup.sessionId = session.id;

	const intensities = ["lite", "full", "ultra"] as const;
	const promptOverhead: Record<string, number> = {};
	const netSavings: Record<string, number> = {};

	for (const intensity of intensities) {
		const overheadPerCall = estimateTokens(buildCaveModePrompt(intensity).length);
		const totalOverhead = overheadPerCall * session.totalAssistantMessages;
		promptOverhead[intensity] = totalOverhead;
		netSavings[intensity] = compression.savingsTokens + dedup.savingsTokens - totalOverhead;
	}

	return { session, compression, dedup, promptOverhead, netSavings };
}
