import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import { Effect } from "effect";
import { RendererDevelopmentServer } from "./electron/security/RendererDevelopmentUrl";
import { createRendererDevelopmentContentSecurityPolicyFx } from "./electron/security/createRendererDevelopmentContentSecurityPolicyFx";

const sourceAlias = {
	"~": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig(({ command }) => {
	const developmentCspNonce =
		command === "serve" ? randomBytes(18).toString("base64") : undefined;

	return {
		main: {
			resolve: {
				alias: sourceAlias,
			},
			build: {
				externalizeDeps: false,
				minify: true,
				outDir: resolve(".out/desktop/build/main"),
				rollupOptions: {
					input: {
						index: resolve("electron/main/index.ts"),
						"cli/arkini": resolve("src/engine/cli/arkini.ts"),
					},
				},
			},
		},
		preload: {
			resolve: {
				alias: sourceAlias,
			},
			build: {
				externalizeDeps: false,
				minify: true,
				outDir: resolve(".out/desktop/build/preload"),
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
			publicDir: "public",
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
								"Content-Security-Policy": Effect.runSync(
									createRendererDevelopmentContentSecurityPolicyFx({
										developmentUrl: RendererDevelopmentServer,
										nonce: developmentCspNonce,
									}),
								),
							},
			},
			html:
				developmentCspNonce === undefined
					? undefined
					: {
							cspNonce: developmentCspNonce,
						},
			resolve: {
				alias: sourceAlias,
			},
			plugins: [
				tanstackRouter({
					target: "react",
					routesDirectory: "./src/@routes",
					generatedRouteTree: "./src/_route.ts",
					tmpDir: ".out/cache/tanstack",
					autoCodeSplitting: false,
					quoteStyle: "double",
				}),
				tailwindcss(),
				viteReact(),
			],
			build: {
				outDir: resolve(".out/desktop/build/renderer"),
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
