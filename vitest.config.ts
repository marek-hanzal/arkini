import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		clearMocks: true,
		environment: "node",
		fileParallelism: false,
		isolate: false,
		include: [
			"src/v1/**/*.test.ts",
		],
		maxWorkers: 1,
		pool: "threads",
		watch: false,
	},
});
