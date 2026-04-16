import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LLMLINGUA2_MANIFEST, modelPath, modelsDir, verifyChecksum, vocabPath } from "../compression/model-download.js";

describe("model-download", () => {
	it("modelsDir points to ~/.cave/models", () => {
		expect(modelsDir()).toBe(join(homedir(), ".cave", "models"));
	});

	it("modelPath joins dir + filename", () => {
		expect(modelPath(LLMLINGUA2_MANIFEST)).toBe(
			join(homedir(), ".cave", "models", LLMLINGUA2_MANIFEST.filename),
		);
	});

	it("vocabPath joins dir + vocabFilename", () => {
		expect(vocabPath(LLMLINGUA2_MANIFEST)).toBe(
			join(homedir(), ".cave", "models", LLMLINGUA2_MANIFEST.vocabFilename!),
		);
	});

	it("verifyChecksum passes for matching hash", async () => {
		const dir = modelsDir();
		await mkdir(dir, { recursive: true });
		const tmp = join(dir, "__test_checksum.tmp");
		const content = "test content for checksum verification";
		const expected = createHash("sha256").update(content).digest("hex");
		await writeFile(tmp, content);
		try {
			expect(await verifyChecksum(tmp, expected)).toBe(true);
		} finally {
			await unlink(tmp).catch(() => {});
		}
	});

	it("verifyChecksum fails for wrong hash", async () => {
		const dir = modelsDir();
		await mkdir(dir, { recursive: true });
		const tmp = join(dir, "__test_checksum2.tmp");
		await writeFile(tmp, "test");
		try {
			expect(await verifyChecksum(tmp, "0000")).toBe(false);
		} finally {
			await unlink(tmp).catch(() => {});
		}
	});

	it("LLMLINGUA2_MANIFEST has required fields", () => {
		expect(LLMLINGUA2_MANIFEST.url).toContain("huggingface.co");
		expect(LLMLINGUA2_MANIFEST.filename).toContain("llmlingua2");
		expect(LLMLINGUA2_MANIFEST.sizeBytes).toBeGreaterThan(0);
		expect(LLMLINGUA2_MANIFEST.vocabUrl).toContain("vocab.txt");
		expect(LLMLINGUA2_MANIFEST.vocabFilename).toBeDefined();
	});
});
