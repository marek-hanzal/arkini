import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { Effect } from "effect";
import {
	authenticateHandler,
	getOAuthProtectedResourceMetadataUrl,
	mcpAuthRouter,
	OAuthServer,
	requireBearerAuth,
} from "mcp-oauth-server";

import type { McpStorage } from "../storage/McpStorage";

export interface RemoteHandler {
	readonly handle: (request: IncomingMessage, response: ServerResponse) => void;
}

const oauthFields = [
	"client_id",
	"response_type",
	"redirect_uri",
	"code_challenge",
	"code_challenge_method",
	"state",
	"scope",
	"resource",
] as const;

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

const readFormValue = (candidate: unknown, field: string) => {
	if (typeof candidate !== "object" || candidate === null) return undefined;
	const value = Reflect.get(candidate, field);
	return typeof value === "string" ? value : undefined;
};

const trustLoopbackProxy = (address: string) =>
	address === "127.0.0.1" || address === "::1" || address.startsWith("::ffff:127.");

const renderConsent = (candidate: unknown, error?: string) => {
	const clientName = readFormValue(candidate, "client_name") ?? "Remote MCP client";
	const redirectUri = readFormValue(candidate, "redirect_uri") ?? "an unknown callback";
	const hidden = oauthFields
		.flatMap((field) => {
			const value = readFormValue(candidate, field);
			return value === undefined
				? []
				: [
						`<input type="hidden" name="${field}" value="${escapeHtml(value)}">`,
					];
		})
		.join("");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Arkini</title>
<style>
:root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #111014; color: #f5f2f7; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
main { width: min(100%, 440px); border: 1px solid #3d3744; border-radius: 18px; padding: 28px; background: #1b181f; box-shadow: 0 20px 70px #0008; }
p { color: #bbb3c2; line-height: 1.55; }
label { display: grid; gap: 8px; margin-top: 24px; font-weight: 650; }
input[type=password] { width: 100%; box-sizing: border-box; border: 1px solid #4b4353; border-radius: 10px; padding: 12px; background: #111014; color: inherit; font: inherit; }
button { width: 100%; margin-top: 18px; border: 0; border-radius: 10px; padding: 12px; background: #ef4d88; color: #fff; font: inherit; font-weight: 750; cursor: pointer; }
.error { color: #ff8ba7; }
</style>
</head>
<body>
<main>
<p>ARKINI EDITOR</p>
<h1>Connect ${escapeHtml(clientName)}</h1>
<p>This client will receive full access to the project currently open in Arkini.</p>
<p>After approval, Arkini will return control to ${escapeHtml(redirectUri)}.</p>
${error === undefined ? "" : `<p class="error">${escapeHtml(error)}</p>`}
<form method="post" action="/confirm">
${hidden}
<label>Remote password<input type="password" name="secret" required autocomplete="current-password"></label>
<button type="submit">Connect to Arkini</button>
</form>
</main>
</body>
</html>`;
};

export namespace createRemoteHandlerFx {
	export interface Props {
		readonly storage: Pick<McpStorage, "model" | "verifySecretFx">;
		readonly mcpHandler: (request: IncomingMessage, response: ServerResponse) => void;
		readonly origin: URL;
		readonly runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>;
	}
}

/** Mounts OAuth and protected MCP routes over one existing Node HTTP listener. */
export const createRemoteHandlerFx = Effect.fn("createRemoteHandlerFx")(
	({ storage, mcpHandler, origin, runPromise }: createRemoteHandlerFx.Props) =>
		Effect.sync((): RemoteHandler => {
			const resourceUrl = new URL("/remote/mcp", origin);
			const provider = new OAuthServer({
				model: storage.model,
				issuerUrl: origin,
				authorizationUrl: new URL("/consent", origin),
				resourceServerUrl: resourceUrl,
				strictResource: false,
				scopesSupported: [
					"editor:mcp",
				],
				grantTypes: [
					"authorization_code",
					"refresh_token",
				],
				refreshTokenLifetime: 90 * 24 * 60 * 60,
				dynamicClientRegistration: true,
				modifyAuthorizationRedirectUrl: (url, client) => {
					url.searchParams.set("client_name", client.client_name ?? "Remote MCP client");
				},
				errorHandler: (step, error) =>
					console.error(`Remote MCP OAuth ${step} failed.`, error),
			});
			const app = express();
			app.disable("x-powered-by");
			app.set("trust proxy", trustLoopbackProxy);
			app.use((request, response, next) => {
				if (request.headers.host === origin.host) {
					next();
					return;
				}
				response.status(404).type("text/plain").send("Not found");
			});
			app.use((_request, response, next) => {
				// The fixed local form action finishes with the OAuth client's validated external redirect.
				// A form-action CSP would make Chromium reject that redirect chain before POSTing.
				response.setHeader(
					"Content-Security-Policy",
					"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
				);
				next();
			});
			app.get("/consent", (request, response) => {
				response.setHeader("Cache-Control", "no-store");
				response.status(200).type("html").send(renderConsent(request.query));
			});
			app.use(
				"/confirm",
				rateLimit({
					windowMs: 5 * 60 * 1_000,
					limit: 10,
					standardHeaders: "draft-8",
					legacyHeaders: false,
				}),
				express.urlencoded({
					extended: false,
				}),
				async (request, response, next) => {
					if (request.method !== "POST") {
						next();
						return;
					}
					const secret = readFormValue(request.body, "secret") ?? "";
					try {
						if (await runPromise(storage.verifySecretFx(secret))) {
							Reflect.set(request, "arkiniMcpUser", "arkini-owner");
							next();
							return;
						}
						response
							.status(401)
							.type("html")
							.send(renderConsent(request.body, "The Remote password is incorrect."));
					} catch (cause) {
						next(cause);
					}
				},
				authenticateHandler({
					provider,
					getUser: (request) => {
						const user = Reflect.get(request, "arkiniMcpUser");
						return typeof user === "string" ? user : "";
					},
				}),
			);
			app.all(
				"/remote/mcp",
				requireBearerAuth({
					verifier: provider,
					requiredScopes: [
						"editor:mcp",
					],
					resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
					resource: resourceUrl,
				}),
				(request, response) => void mcpHandler(request, response),
			);
			app.use(
				mcpAuthRouter({
					provider,
					baseUrl: origin,
					resourceServerUrl: resourceUrl,
					resourceName: "Arkini Editor MCP",
					scopesSupported: [
						"editor:mcp",
					],
				}),
			);
			app.use((_request, response) =>
				response.status(404).type("text/plain").send("Not found"),
			);
			return {
				handle: app,
			};
		}),
);
