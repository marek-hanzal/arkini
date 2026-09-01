import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"~scripts": fileURLToPath(new URL("./scripts", import.meta.url)),
			"~": fileURLToPath(new URL("./src", import.meta.url)),
			"~electron": fileURLToPath(new URL("./electron", import.meta.url)),
			"~shared": fileURLToPath(new URL("./shared", import.meta.url)),
			"~test": fileURLToPath(new URL("./test", import.meta.url)),
		},
	},
	test: {
		clearMocks: true,
		environment: "node",
		fileParallelism: true,
		isolate: true,
		include: [
			"test/**/*.test.{ts,tsx}",
		],
		maxWorkers: "50%",
		pool: "threads",
		restoreMocks: true,
		setupFiles: [
			"./test/setup.ts",
		],
		testTimeout: 10_000,
		unstubEnvs: true,
		unstubGlobals: true,
		watch: false,
	},
});
