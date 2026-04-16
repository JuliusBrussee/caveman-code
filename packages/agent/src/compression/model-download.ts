// T-081: ONNX model download with SHA256 checksum gate.

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
}

/**
 * LLMLingua-2 BERT-base model exported to ONNX.
 *
 * SHA256 placeholder: replaced after first verified download or when
 * the upstream publishes a stable ONNX artifact with a pinned hash.
 */
export const LLMLINGUA2_MANIFEST: ModelManifest = {
	url: "https://huggingface.co/microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank/resolve/main/onnx/model.onnx",
	sha256: "",
	filename: "llmlingua2-bert-base.onnx",
	sizeBytes: 710_000_000,
};

export function modelsDir(): string {
	return join(homedir(), ".cave", "models");
}

export function modelPath(manifest: ModelManifest): string {
	return join(modelsDir(), manifest.filename);
}

export async function isModelCached(manifest: ModelManifest): Promise<boolean> {
	try {
		const s = await stat(modelPath(manifest));
		return s.isFile() && s.size > 0;
	} catch {
		return false;
	}
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
}

export async function downloadModel(
	manifest: ModelManifest,
	onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
	const dir = modelsDir();
	await mkdir(dir, { recursive: true });

	const dest = modelPath(manifest);
	const tmp = `${dest}.tmp`;

	// Already cached + valid?
	if (await isModelCached(manifest)) {
		if (manifest.sha256) {
			const valid = await verifyChecksum(dest, manifest.sha256);
			if (valid) return dest;
			await unlink(dest).catch(() => {});
		} else {
			return dest;
		}
	}

	const response = await fetch(manifest.url, { redirect: "follow" });
	if (!response.ok) {
		throw new Error(`model download failed: ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error("model download: empty response body");
	}

	const writer = createWriteStream(tmp);
	const reader = Readable.fromWeb(response.body as any);
	let bytesDownloaded = 0;

	reader.on("data", (chunk: Buffer) => {
		bytesDownloaded += chunk.length;
		onProgress?.({ bytesDownloaded, totalBytes: manifest.sizeBytes });
	});

	await pipeline(reader, writer);

	// Verify checksum when set
	if (manifest.sha256) {
		const valid = await verifyChecksum(tmp, manifest.sha256);
		if (!valid) {
			await unlink(tmp).catch(() => {});
			throw new Error(`model checksum mismatch: ${manifest.filename}`);
		}
	}

	// Atomic rename
	await rename(tmp, dest);
	return dest;
}
