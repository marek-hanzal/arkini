import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";

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
		root: ".",
		publicDir: false,
		base: process.env.VITE_BASE ?? "/",
		clearScreen: false,
		server: {
			port: 4040,
			strictPort: true,
		},
		resolve: {
			alias: {
				"~": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},
		plugins: [
			tanstackRouter({
				target: "react",
				routesDirectory: "./src/@routes",
				generatedRouteTree: "./src/_route.ts",
				autoCodeSplitting: true,
				quoteStyle: "double",
			}),
			tailwindcss(),
			viteReact(),
		],
		build: {
			target: "esnext",
			rollupOptions: {
				input: resolve("index.html"),
			},
		},
		worker: {
			format: "es",
		},
	},
});
