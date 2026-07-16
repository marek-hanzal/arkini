import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	base: process.env.VITE_BASE ?? "/",
	clearScreen: false,
	server: {
		port: 4040,
		strictPort: true,
	},
	preview: {
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
	},
	worker: {
		format: "es",
	},
});
