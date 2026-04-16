// T-082: WordPiece tokenizer for bert-base-multilingual-cased.
//
// Pure TypeScript, zero dependencies. Loads vocab.txt (one token per line,
// line number = token id). Produces token sequences compatible with the
// LLMLingua-2 ONNX model.
//
// Span-based: every token carries its character offsets in the original
// text so reconstruction can slice the original instead of joining with
// spaces — preserving newlines, indentation, and all whitespace.

import { readFileSync } from "node:fs";

export interface BertToken {
	/** Token id in the vocabulary. */
	id: number;
	/** Surface form (e.g. "hello" or "##ing"). */
	text: string;
	/** Index of the original word this token belongs to (-1 for special tokens). */
	wordIndex: number;
	/** True when this token is a WordPiece continuation (starts with ##). */
	isSubword: boolean;
	/** Start character offset in the original text (-1 for special tokens). */
	startOffset: number;
	/** End character offset (exclusive) in the original text (-1 for special tokens). */
	endOffset: number;
}

interface PreToken {
	word: string;
	start: number;
	end: number;
}

const CLS_TOKEN = "[CLS]";
const SEP_TOKEN = "[SEP]";
const UNK_TOKEN = "[UNK]";
const PAD_TOKEN = "[PAD]";
const SUBWORD_PREFIX = "##";

/** Max sequence length for BERT (including [CLS] and [SEP]). */
const MAX_SEQ_LEN = 512;
/** Usable token slots after reserving [CLS] and [SEP]. */
const MAX_TOKENS = MAX_SEQ_LEN - 2;

export class BertTokenizer {
	private readonly vocab: Map<string, number>;
	private readonly unkId: number;
	private readonly clsId: number;
	private readonly sepId: number;

	/** Load vocabulary from a file path (sync — vocab.txt is <1MB). */
	constructor(vocabPath: string) {
		const text = readFileSync(vocabPath, "utf-8");
		const vocab = BertTokenizer.parseVocab(text);
		this.vocab = vocab;
		this.unkId = vocab.get(UNK_TOKEN) ?? 100;
		this.clsId = vocab.get(CLS_TOKEN) ?? 101;
		this.sepId = vocab.get(SEP_TOKEN) ?? 102;
	}

	/** Construct from raw vocab.txt content (for tests — no filesystem). */
	static fromVocabTxt(text: string): BertTokenizer {
		const vocab = BertTokenizer.parseVocab(text);
		const instance = Object.create(BertTokenizer.prototype) as BertTokenizer;
		Object.defineProperties(instance, {
			vocab: { value: vocab, writable: false },
			unkId: { value: vocab.get(UNK_TOKEN) ?? 100, writable: false },
			clsId: { value: vocab.get(CLS_TOKEN) ?? 101, writable: false },
			sepId: { value: vocab.get(SEP_TOKEN) ?? 102, writable: false },
		});
		return instance;
	}

	private static parseVocab(text: string): Map<string, number> {
		const vocab = new Map<string, number>();
		const lines = text.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const token = lines[i].trimEnd();
			if (token.length > 0) {
				vocab.set(token, i);
			}
		}
		return vocab;
	}

	get vocabSize(): number {
		return this.vocab.size;
	}

	/**
	 * Tokenize text into BertTokens with character span offsets.
	 *
	 * Returns [CLS] + content tokens + [SEP], truncated to 512 total.
	 * This is a cased tokenizer — no lowercasing is applied.
	 */
	tokenize(text: string): BertToken[] {
		const preTokens = this.preTokenize(text);
		const tokens: BertToken[] = [
			{ id: this.clsId, text: CLS_TOKEN, wordIndex: -1, isSubword: false, startOffset: -1, endOffset: -1 },
		];

		let tokenCount = 0;
		for (let wi = 0; wi < preTokens.length; wi++) {
			const pt = preTokens[wi];
			const wordTokens = this.wordpieceEncode(pt.word);
			if (tokenCount + wordTokens.length > MAX_TOKENS) {
				const remaining = MAX_TOKENS - tokenCount;
				for (let j = 0; j < remaining; j++) {
					tokens.push({ ...wordTokens[j], wordIndex: wi, startOffset: pt.start, endOffset: pt.end });
					tokenCount++;
				}
				break;
			}
			for (const wt of wordTokens) {
				tokens.push({ ...wt, wordIndex: wi, startOffset: pt.start, endOffset: pt.end });
				tokenCount++;
			}
		}

		tokens.push({ id: this.sepId, text: SEP_TOKEN, wordIndex: -1, isSubword: false, startOffset: -1, endOffset: -1 });
		return tokens;
	}

	/**
	 * Reconstruct text from tokens.
	 *
	 * Strips [CLS], [SEP], [PAD]. Merges ## subword tokens with their
	 * preceding token (no space). Inserts space between non-subword tokens.
	 *
	 * NOTE: This loses original whitespace. Prefer `reconstructFromOriginal()`
	 * when the original text is available.
	 */
	decode(tokens: BertToken[]): string {
		const parts: string[] = [];
		for (const token of tokens) {
			if (token.text === CLS_TOKEN || token.text === SEP_TOKEN || token.text === PAD_TOKEN) {
				continue;
			}
			if (token.isSubword) {
				parts.push(token.text.slice(SUBWORD_PREFIX.length));
			} else {
				if (parts.length > 0) {
					parts.push(" ");
				}
				parts.push(token.text);
			}
		}
		return parts.join("");
	}

	/**
	 * Reconstruct compressed text from original + kept tokens.
	 *
	 * Uses character span offsets to slice the original text, preserving
	 * original whitespace, newlines, and indentation between kept words.
	 */
	reconstructFromOriginal(original: string, keptTokens: BertToken[]): string {
		// Deduplicate by wordIndex — all subwords of a word share the same span
		const keptWords = new Map<number, { start: number; end: number }>();
		for (const token of keptTokens) {
			if (token.wordIndex < 0) continue; // skip special tokens
			if (!keptWords.has(token.wordIndex)) {
				keptWords.set(token.wordIndex, { start: token.startOffset, end: token.endOffset });
			}
		}

		if (keptWords.size === 0) return "";

		// Sort by start offset
		const spans = [...keptWords.values()].sort((a, b) => a.start - b.start);

		const parts: string[] = [];
		let lastEnd = -1;

		for (const span of spans) {
			if (lastEnd >= 0) {
				// Extract a separator from the gap between kept words.
				// The gap may contain dropped words — only keep whitespace structure.
				const gap = original.slice(lastEnd, span.start);
				const separator = extractWhitespaceSeparator(gap);
				parts.push(separator);
			}
			parts.push(original.slice(span.start, span.end));
			lastEnd = span.end;
		}

		return parts.join("");
	}

	/**
	 * Split text into chunks that each fit within maxTokens.
	 *
	 * Returns chunks with their character offsets in the original text
	 * so the caller can reconstruct with proper inter-chunk whitespace.
	 */
	chunkText(text: string, maxTokens = MAX_TOKENS): Array<{ text: string; start: number; end: number }> {
		const preTokens = this.preTokenize(text);
		if (preTokens.length === 0) return [{ text, start: 0, end: text.length }];

		const chunks: Array<{ text: string; start: number; end: number }> = [];
		let chunkStart = -1;
		let chunkEnd = -1;
		let chunkTokenCount = 0;

		for (const pt of preTokens) {
			const wordTokenCount = this.wordpieceEncode(pt.word).length;
			if (chunkTokenCount + wordTokenCount > maxTokens && chunkStart >= 0) {
				chunks.push({ text: text.slice(chunkStart, chunkEnd), start: chunkStart, end: chunkEnd });
				chunkStart = -1;
				chunkEnd = -1;
				chunkTokenCount = 0;
			}
			if (chunkStart < 0) chunkStart = pt.start;
			chunkEnd = pt.end;
			chunkTokenCount += wordTokenCount;
		}
		if (chunkStart >= 0) {
			chunks.push({ text: text.slice(chunkStart, chunkEnd), start: chunkStart, end: chunkEnd });
		}
		return chunks;
	}

	/**
	 * Split text into pre-tokens on whitespace and punctuation boundaries.
	 * Returns words with their character offsets.
	 */
	private preTokenize(text: string): PreToken[] {
		const words: PreToken[] = [];
		let start = -1;

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (isWhitespace(ch)) {
				if (start >= 0) {
					words.push({ word: text.slice(start, i), start, end: i });
					start = -1;
				}
			} else if (isPunctuation(ch)) {
				if (start >= 0) {
					words.push({ word: text.slice(start, i), start, end: i });
					start = -1;
				}
				words.push({ word: ch, start: i, end: i + 1 });
			} else {
				if (start < 0) start = i;
			}
		}
		if (start >= 0) {
			words.push({ word: text.slice(start), start, end: text.length });
		}
		return words;
	}

	/**
	 * WordPiece encode a single word.
	 *
	 * Greedy longest-match-first from left to right. Falls back to [UNK]
	 * if the word cannot be segmented.
	 */
	private wordpieceEncode(word: string): Omit<BertToken, "wordIndex" | "startOffset" | "endOffset">[] {
		if (this.vocab.has(word)) {
			return [{ id: this.vocab.get(word)!, text: word, isSubword: false }];
		}

		const tokens: Omit<BertToken, "wordIndex" | "startOffset" | "endOffset">[] = [];
		let start = 0;
		let isFirst = true;

		while (start < word.length) {
			let end = word.length;
			let matched = false;

			while (start < end) {
				const substr = isFirst ? word.slice(start, end) : `${SUBWORD_PREFIX}${word.slice(start, end)}`;
				if (this.vocab.has(substr)) {
					tokens.push({
						id: this.vocab.get(substr)!,
						text: substr,
						isSubword: !isFirst,
					});
					matched = true;
					start = end;
					isFirst = false;
					break;
				}
				end--;
			}

			if (!matched) {
				return [{ id: this.unkId, text: UNK_TOKEN, isSubword: false }];
			}
		}

		return tokens;
	}
}

/**
 * Extract whitespace separator from a gap between two kept words.
 *
 * The gap may contain dropped words — we only want the whitespace structure.
 * Preserves newlines (for code structure) but collapses multiple blank lines.
 */
function extractWhitespaceSeparator(gap: string): string {
	if (gap.includes("\n")) {
		// Preserve newline structure: count newlines, keep indentation before next word
		const newlines = (gap.match(/\n/g) || []).length;
		const lastNewlineIdx = gap.lastIndexOf("\n");
		const trailingIndent = gap.slice(lastNewlineIdx + 1).replace(/\S/g, "");
		const nl = Math.min(newlines, 2); // Cap at 1 blank line
		return "\n".repeat(nl) + trailingIndent;
	}
	return " ";
}

function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v";
}

function isPunctuation(ch: string): boolean {
	const code = ch.charCodeAt(0);
	if ((code >= 33 && code <= 47) || (code >= 58 && code <= 64) ||
		(code >= 91 && code <= 96) || (code >= 123 && code <= 126)) {
		return true;
	}
	if (code >= 0x2000 && code <= 0x206F) return true;
	if (code >= 0x3000 && code <= 0x303F) return true;
	return false;
}
