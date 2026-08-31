import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import { RendererDevelopmentServer } from "./electron/security/RendererDevelopmentUrl";
import { createRendererDevelopmentContentSecurityPolicyFn } from "./electron/security/fn/createRendererDevelopmentContentSecurityPolicyFn";
import { ArkpackDistributionChannelDefaults } from "./src/arkpack-artifact/constant/ArkpackDistributionChannel";

const sourceAlias = {
	"~": fileURLToPath(new URL("./src", import.meta.url)),
	"~electron": fileURLToPath(new URL("./electron", import.meta.url)),
	"~shared": fileURLToPath(new URL("./shared", import.meta.url)),
};
const releaseIssuer =
	process.env.ARKINI_RELEASE_ISSUER ?? ArkpackDistributionChannelDefaults.issuer;
const releaseIdentity =
	process.env.ARKINI_RELEASE_IDENTITY ?? ArkpackDistributionChannelDefaults.workflow;
new URL(releaseIssuer);
new URL(releaseIdentity);

export default defineConfig(({ command }) => {
	const developmentCspNonce =
		command === "serve" ? randomBytes(18).toString("base64") : undefined;

	return {
		main: {
			define: {
				__ARKINI_RELEASE_ISSUER__: JSON.stringify(releaseIssuer),
				__ARKINI_RELEASE_IDENTITY__: JSON.stringify(releaseIdentity),
			},
			resolve: {
				alias: sourceAlias,
			},
			build: {
				externalizeDeps: false,
				minify: true,
				outDir: resolve(".out/desktop/build/main"),
				rollupOptions: {
					external: [
						/^@ngrok\/ngrok(?:$|-)/,
					],
					input: {
						index: resolve("electron/main/index.ts"),
						"cli/arkini": resolve("src/arkini-cli/arkini.ts"),
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
								"Content-Security-Policy":
									createRendererDevelopmentContentSecurityPolicyFn({
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
