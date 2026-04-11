import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000, // 30 seconds for API calls
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"test/benchmarks/tasks/**", // Task setup files are test fixtures, not runnable tests
		],
		server: {
			deps: {
				external: [/@silvia-odwyer\/photon-node/],
			},
		},
	},
});
