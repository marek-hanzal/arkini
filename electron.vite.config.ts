import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import rendererConfig from "./vite.config";

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: resolve("electron/main/index.ts"),
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: resolve("electron/preload/index.ts"),
				output: {
					format: "cjs",
					entryFileNames: "index.cjs",
				},
			},
		},
	},
	renderer: {
		...rendererConfig,
		root: ".",
		publicDir: false,
		build: {
			...rendererConfig.build,
			rollupOptions: {
				input: resolve("index.html"),
			},
		},
	},
});
