import { describe, expect, it } from "vitest";
import { loadSweBenchFromFile } from "../bench/swe-bench-dataset.js";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("swe-bench-dataset", () => {
	it("loads instances from JSONL file", async () => {
		const dir = join(tmpdir(), "swe-bench-test");
		await mkdir(dir, { recursive: true });
		const filePath = join(dir, "test.jsonl");
		const lines = [
			JSON.stringify({
				instance_id: "django__django-11099",
				repo: "django/django",
				base_commit: "abc123",
				problem_statement: "Fix issue with QuerySet",
				patch: "",
				test_patch: "",
				hints_text: "",
				created_at: "2023-01-01",
				version: "1.0",
				FAIL_TO_PASS: "[]",
				PASS_TO_PASS: "[]",
				environment_setup_commit: "def456",
			}),
			JSON.stringify({
				instance_id: "flask__flask-5000",
				repo: "pallets/flask",
				base_commit: "xyz789",
				problem_statement: "Fix routing bug",
				patch: "",
				test_patch: "",
				hints_text: "",
				created_at: "2023-02-01",
				version: "1.0",
				FAIL_TO_PASS: "[]",
				PASS_TO_PASS: "[]",
				environment_setup_commit: "ghi012",
			}),
		];
		await writeFile(filePath, lines.join("\n"));

		const all = await loadSweBenchFromFile(filePath);
		expect(all).toHaveLength(2);
		expect(all[0].id).toBe("django__django-11099");
		expect(all[0].repo).toBe("django/django");
		expect(all[0].problem_statement).toBe("Fix issue with QuerySet");

		const filtered = await loadSweBenchFromFile(filePath, { repos: ["pallets/flask"] });
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("flask__flask-5000");

		const limited = await loadSweBenchFromFile(filePath, { limit: 1 });
		expect(limited).toHaveLength(1);

		await unlink(filePath).catch(() => {});
	});
});
