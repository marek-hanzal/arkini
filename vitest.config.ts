import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TestArkpackPublicKey } from "./test/support/arkpack/TestArkpackSigningIdentity.ts";

export default defineConfig({
	define: {
		__ARKINI_PUBLIC_KEY__: JSON.stringify(TestArkpackPublicKey),
	},
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./src", import.meta.url)),
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
		unstubEnvs: true,
		unstubGlobals: true,
		watch: false,
	},
});
