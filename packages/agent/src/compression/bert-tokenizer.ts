// T-082: WordPiece tokenizer for bert-base-multilingual-cased.
//
// Pure TypeScript, zero dependencies. Loads vocab.txt (one token per line,
// line number = token id). Produces token sequences compatible with the
// LLMLingua-2 ONNX model.

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
	 * Tokenize text into BertTokens.
	 *
	 * Returns [CLS] + content tokens + [SEP], truncated to 512 total.
	 * This is a cased tokenizer — no lowercasing is applied.
	 */
	tokenize(text: string): BertToken[] {
		const words = this.preTokenize(text);
		const tokens: BertToken[] = [
			{ id: this.clsId, text: CLS_TOKEN, wordIndex: -1, isSubword: false },
		];

		let tokenCount = 0;
		for (let wi = 0; wi < words.length; wi++) {
			const wordTokens = this.wordpieceEncode(words[wi]);
			// Check if adding these tokens would exceed the limit
			if (tokenCount + wordTokens.length > MAX_TOKENS) {
				// Add as many as we can fit
				const remaining = MAX_TOKENS - tokenCount;
				for (let j = 0; j < remaining; j++) {
					tokens.push({ ...wordTokens[j], wordIndex: wi });
					tokenCount++;
				}
				break;
			}
			for (const wt of wordTokens) {
				tokens.push({ ...wt, wordIndex: wi });
				tokenCount++;
			}
		}

		tokens.push({ id: this.sepId, text: SEP_TOKEN, wordIndex: -1, isSubword: false });
		return tokens;
	}

	/**
	 * Reconstruct text from tokens.
	 *
	 * Strips [CLS], [SEP], [PAD]. Merges ## subword tokens with their
	 * preceding token (no space). Inserts space between non-subword tokens.
	 */
	decode(tokens: BertToken[]): string {
		const parts: string[] = [];
		for (const token of tokens) {
			if (token.text === CLS_TOKEN || token.text === SEP_TOKEN || token.text === PAD_TOKEN) {
				continue;
			}
			if (token.isSubword) {
				// Strip ## prefix and append without space
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
	 * Split text into chunks that each fit within maxTokens.
	 *
	 * Uses word boundaries to avoid splitting mid-word. Each chunk
	 * is a substring of the original text.
	 */
	chunkText(text: string, maxTokens = MAX_TOKENS): string[] {
		const words = this.preTokenize(text);
		if (words.length === 0) return [text];

		const chunks: string[] = [];
		let chunkWords: string[] = [];
		let chunkTokenCount = 0;

		for (const word of words) {
			const wordTokenCount = this.wordpieceEncode(word).length;
			if (chunkTokenCount + wordTokenCount > maxTokens && chunkWords.length > 0) {
				chunks.push(chunkWords.join(" "));
				chunkWords = [];
				chunkTokenCount = 0;
			}
			chunkWords.push(word);
			chunkTokenCount += wordTokenCount;
		}
		if (chunkWords.length > 0) {
			chunks.push(chunkWords.join(" "));
		}
		return chunks;
	}

	/**
	 * Split text into pre-tokens on whitespace and punctuation boundaries.
	 *
	 * BERT-style: each punctuation character becomes its own token.
	 * Whitespace is consumed as a delimiter.
	 */
	private preTokenize(text: string): string[] {
		const words: string[] = [];
		let current = "";

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (isWhitespace(ch)) {
				if (current) {
					words.push(current);
					current = "";
				}
			} else if (isPunctuation(ch)) {
				if (current) {
					words.push(current);
					current = "";
				}
				words.push(ch);
			} else {
				current += ch;
			}
		}
		if (current) {
			words.push(current);
		}
		return words;
	}

	/**
	 * WordPiece encode a single word.
	 *
	 * Greedy longest-match-first from left to right. First piece uses the
	 * raw form; subsequent pieces use the ## prefix. Falls back to [UNK]
	 * if the word cannot be segmented.
	 */
	private wordpieceEncode(word: string): Omit<BertToken, "wordIndex">[] {
		if (this.vocab.has(word)) {
			return [{ id: this.vocab.get(word)!, text: word, isSubword: false }];
		}

		const tokens: Omit<BertToken, "wordIndex">[] = [];
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
				// Cannot segment this word — return single [UNK]
				return [{ id: this.unkId, text: UNK_TOKEN, isSubword: false }];
			}
		}

		return tokens;
	}
}

function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v";
}

function isPunctuation(ch: string): boolean {
	const code = ch.charCodeAt(0);
	// ASCII punctuation ranges
	if ((code >= 33 && code <= 47) || (code >= 58 && code <= 64) ||
		(code >= 91 && code <= 96) || (code >= 123 && code <= 126)) {
		return true;
	}
	// Unicode general punctuation (broad check for common cases)
	if (code >= 0x2000 && code <= 0x206F) return true;
	if (code >= 0x3000 && code <= 0x303F) return true;
	return false;
}
