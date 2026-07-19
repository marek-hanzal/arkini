import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import { createRendererDevelopmentContentSecurityPolicy } from "./desktop/security/RendererContentSecurityPolicy";
import { RendererDevelopmentServer } from "./desktop/security/RendererDevelopmentUrl";

export default defineConfig(({ command }) => {
	const developmentCspNonce =
		command === "serve" ? randomBytes(18).toString("base64") : undefined;

	return {
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
				host: RendererDevelopmentServer.hostname,
				port: RendererDevelopmentServer.port,
				strictPort: true,
				headers:
					developmentCspNonce === undefined
						? undefined
						: {
								"Content-Security-Policy":
									createRendererDevelopmentContentSecurityPolicy({
										developmentUrl: RendererDevelopmentServer,
										nonce: developmentCspNonce,
									}),
							},
			},
			html:
				developmentCspNonce === undefined
					? undefined
					: {
							cspNonce: developmentCspNonce,
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
					autoCodeSplitting: false,
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
	};
});
