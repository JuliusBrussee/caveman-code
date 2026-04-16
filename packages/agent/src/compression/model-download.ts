// T-081, T-082: ONNX model + vocab download with SHA256 checksum gate.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface ModelManifest {
	url: string;
	sha256: string;
	filename: string;
	sizeBytes: number;
	/** URL for the vocab.txt file (required for tokenization). */
	vocabUrl?: string;
	/** Filename for the vocab file in the models directory. */
	vocabFilename?: string;
	/** SHA256 of the vocab file (empty string to skip verification). */
	vocabSha256?: string;
}

/**
 * LLMLingua-2 BERT-base multilingual model — INT8 quantized ONNX.
 *
 * Quantized via ONNX Runtime dynamic quantization from the fp32 original.
 * ~110MB vs 710MB fp32. SHA256 placeholder until artifact is pinned.
 */
export const LLMLINGUA2_MANIFEST: ModelManifest = {
	url: "https://huggingface.co/microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank/resolve/main/onnx/model_quantized.onnx",
	sha256: "",
	filename: "llmlingua2-bert-base-q8.onnx",
	sizeBytes: 110_000_000,
	vocabUrl: "https://huggingface.co/google-bert/bert-base-multilingual-cased/resolve/main/vocab.txt",
	vocabFilename: "llmlingua2-bert-base.vocab.txt",
	vocabSha256: "",
};

export function modelsDir(): string {
	return join(homedir(), ".cave", "models");
}

export function modelPath(manifest: ModelManifest): string {
	return join(modelsDir(), manifest.filename);
}

export function vocabPath(manifest: ModelManifest): string {
	return join(modelsDir(), manifest.vocabFilename ?? "vocab.txt");
}

async function fileExists(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isFile() && s.size > 0;
	} catch {
		return false;
	}
}

export async function isModelCached(manifest: ModelManifest): Promise<boolean> {
	const modelOk = await fileExists(modelPath(manifest));
	if (!modelOk) return false;
	// If manifest has vocab, check that too
	if (manifest.vocabFilename) {
		return fileExists(vocabPath(manifest));
	}
	return true;
}

export async function verifyChecksum(filePath: string, expected: string): Promise<boolean> {
	const hash = createHash("sha256");
	const stream = createReadStream(filePath);
	for await (const chunk of stream) {
		hash.update(chunk as Buffer);
	}
	return hash.digest("hex") === expected;
}

export interface DownloadProgress {
	bytesDownloaded: number;
	totalBytes: number;
	artifact: string;
}

/** Download a single artifact to the models directory with checksum verification. */
async function downloadArtifact(
	url: string,
	destPath: string,
	sha256: string,
	sizeBytes: number,
	artifactName: string,
	onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
	const dir = modelsDir();
	await mkdir(dir, { recursive: true });

	const tmp = `${destPath}.tmp`;

	// Already cached + valid?
	if (await fileExists(destPath)) {
		if (sha256) {
			const valid = await verifyChecksum(destPath, sha256);
			if (valid) return;
			await unlink(destPath).catch(() => {});
		} else {
			return;
		}
	}

	const response = await fetch(url, { redirect: "follow" });
	if (!response.ok) {
		throw new Error(`download failed (${artifactName}): ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error(`download failed (${artifactName}): empty response body`);
	}

	const writer = createWriteStream(tmp);
	const reader = Readable.fromWeb(response.body as any);
	let bytesDownloaded = 0;

	reader.on("data", (chunk: Buffer) => {
		bytesDownloaded += chunk.length;
		onProgress?.({ bytesDownloaded, totalBytes: sizeBytes, artifact: artifactName });
	});

	await pipeline(reader, writer);

	if (sha256) {
		const valid = await verifyChecksum(tmp, sha256);
		if (!valid) {
			await unlink(tmp).catch(() => {});
			throw new Error(`checksum mismatch: ${artifactName}`);
		}
	}

	await rename(tmp, destPath);
}

/** Download model ONNX file + vocab.txt if not cached. */
export async function downloadModel(
	manifest: ModelManifest,
	onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
	// Download model
	await downloadArtifact(
		manifest.url,
		modelPath(manifest),
		manifest.sha256,
		manifest.sizeBytes,
		manifest.filename,
		onProgress,
	);

	// Download vocab if specified
	if (manifest.vocabUrl && manifest.vocabFilename) {
		await downloadArtifact(
			manifest.vocabUrl,
			vocabPath(manifest),
			manifest.vocabSha256 ?? "",
			1_000_000, // vocab.txt is ~1MB
			manifest.vocabFilename,
			onProgress,
		);
	}

	return modelPath(manifest);
}
