import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import {
	findInitialModel,
	resolveCliModel,
	resolveModelScope,
	restoreModelFromSession,
} from "../src/core/model-resolver.js";

function registry() {
	const auth = AuthStorage.inMemory();
	auth.setRuntimeApiKey("minimax", "fixture-key");
	return new ModelRegistry(auth, "/nonexistent/caveman-minimax-test/models.json");
}

describe("MiniMax selection compatibility", () => {
	it("uses Flash first for a fresh configuration and excludes legacy ordinary choices", async () => {
		const modelRegistry = registry();
		expect(modelRegistry.getAvailable().map((model) => model.id)).toEqual(["MiniMax-M3.1-Flash", "MiniMax-M3"]);
		const result = await findInitialModel({ modelRegistry, scopedModels: [], isContinuing: false });
		expect(result.model?.id).toBe("MiniMax-M3.1-Flash");
	});

	it("resolves an exact legacy CLI ID, a saved default, a user-authored scope, and session restore", async () => {
		const modelRegistry = registry();
		const legacy = modelRegistry.find("minimax", "MiniMax-M2.7")!;
		expect(resolveCliModel({ modelRegistry, cliProvider: "minimax", cliModel: legacy.id }).model).toBe(legacy);
		const result = await findInitialModel({
			modelRegistry,
			scopedModels: [],
			isContinuing: false,
			defaultProvider: "minimax",
			defaultModelId: legacy.id,
		});
		expect(result.model).toBe(legacy);
		expect((await resolveModelScope([`minimax/${legacy.id}`], modelRegistry))[0].model).toBe(legacy);
		expect((await restoreModelFromSession("minimax", legacy.id, undefined, false, modelRegistry)).model).toBe(legacy);
	});

	it("keeps custom legacy-shaped definitions selectable", () => {
		const modelRegistry = registry();
		modelRegistry.registerProvider("custom-minimax", {
			api: "anthropic-messages",
			baseUrl: "https://custom.example/anthropic",
			apiKey: "fixture-key",
			models: [
				{
					id: "MiniMax-M2.7",
					name: "My pinned model",
					reasoning: true,
					input: ["text"],
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: 204800,
					maxTokens: 4096,
				},
			],
		});
		expect(modelRegistry.getSelectable()).toContain(modelRegistry.find("custom-minimax", "MiniMax-M2.7"));
	});
});
