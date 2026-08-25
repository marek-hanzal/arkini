import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorMcpRemoteHandler } from "../../../../electron/main/editor-mcp/auth/createEditorMcpRemoteHandlerFx";
import { createEditorMcpRemoteHandlerFx } from "../../../../electron/main/editor-mcp/auth/createEditorMcpRemoteHandlerFx";
import { createSqliteEditorMcpAuthOwnershipFx } from "../../../../electron/main/editor-mcp/auth/createSqliteEditorMcpAuthOwnershipFx";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const startRemoteHandler = async () => {
	let handler: EditorMcpRemoteHandler | undefined;
	const server = createServer((request, response) => {
		if (handler === undefined) throw new Error("Remote handler is unavailable.");
		handler.handle(request, response);
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	cleanups.push(
		() =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error === undefined ? resolve() : reject(error))),
			),
	);
	const address = server.address();
	if (address === null || typeof address === "string")
		throw new Error("Expected an ephemeral HTTP port.");
	const origin = new URL(`http://127.0.0.1:${address.port}`);
	const auth = Effect.runSync(
		createSqliteEditorMcpAuthOwnershipFx({
			databasePath: ":memory:",
		}),
	);
	cleanups.push(() => Effect.runPromise(auth.closeFx));
	const secret = await Effect.runPromise(auth.ensureSecretFx);
	if (secret === undefined) throw new Error("Expected the initial Remote password.");
	const mcpHandler = vi.fn((_request, response) => (response.statusCode = 204));
	handler = Effect.runSync(
		createEditorMcpRemoteHandlerFx({
			auth,
			mcpHandler: (request, response) => {
				mcpHandler(request, response);
				response.end();
			},
			origin,
			runPromise: Effect.runPromise,
		}),
	);
	return {
		mcpHandler,
		origin,
		secret,
	};
};

describe("createEditorMcpRemoteHandlerFx", () => {
	it("completes PKCE login with the generated password and protects the remote MCP endpoint", async () => {
		const { mcpHandler, origin, secret } = await startRemoteHandler();
		const resource = new URL("/remote/mcp", origin).href;
		const metadata = await fetch(new URL("/.well-known/oauth-authorization-server", origin));
		expect(metadata.status).toBe(200);
		await expect(metadata.json()).resolves.toMatchObject({
			issuer: origin.href,
			registration_endpoint: new URL("/register", origin).href,
		});
		const challenge = await fetch(resource);
		expect(challenge.status).toBe(401);
		expect(challenge.headers.get("www-authenticate")).toContain("resource_metadata");

		const redirectUri = "http://127.0.0.1:49151/callback";
		const registration = await fetch(new URL("/register", origin), {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				client_name: "Arkini test client",
				redirect_uris: [
					redirectUri,
				],
				token_endpoint_auth_method: "none",
				grant_types: [
					"authorization_code",
					"refresh_token",
				],
				response_types: [
					"code",
				],
			}),
		});
		expect(registration.status).toBe(201);
		const registered = (await registration.json()) as {
			readonly client_id: string;
		};
		const verifier = "arkini-editor-mcp-pkce-verifier-abcdefghijklmnopqrstuvwxyz0123456789";
		const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
		const authorize = new URL("/authorize", origin);
		authorize.search = new URLSearchParams({
			client_id: registered.client_id,
			response_type: "code",
			redirect_uri: redirectUri,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			state: "arkini-state",
			scope: "editor:mcp",
			resource,
		}).toString();
		const authorization = await fetch(authorize, {
			redirect: "manual",
		});
		expect(authorization.status).toBe(302);
		const consentUrl = authorization.headers.get("location");
		if (consentUrl === null) throw new Error("Expected OAuth consent redirect.");
		const consent = await fetch(consentUrl);
		expect(consent.status).toBe(200);
		expect(await consent.text()).toContain("Arkini test client");

		const consentFields = new URL(consentUrl).searchParams;
		const wrongPassword = await fetch(new URL("/confirm", origin), {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams([
				...consentFields,
				[
					"secret",
					"wrong-password",
				],
			]),
			redirect: "manual",
		});
		expect(wrongPassword.status).toBe(401);
		const approval = await fetch(new URL("/confirm", origin), {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams([
				...consentFields,
				[
					"secret",
					secret,
				],
			]),
			redirect: "manual",
		});
		expect(approval.status, await approval.clone().text()).toBe(302);
		const callback = approval.headers.get("location");
		if (callback === null) throw new Error("Expected OAuth callback redirect.");
		const code = new URL(callback).searchParams.get("code");
		if (code === null) throw new Error("Expected authorization code.");

		const token = await fetch(new URL("/token", origin), {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: registered.client_id,
				redirect_uri: redirectUri,
				code,
				code_verifier: verifier,
			}),
		});
		expect(token.status).toBe(200);
		const tokens = (await token.json()) as {
			readonly access_token: string;
		};
		const protectedMcp = await fetch(resource, {
			headers: {
				authorization: `Bearer ${tokens.access_token}`,
			},
		});
		expect(protectedMcp.status).toBe(204);
		expect(mcpHandler).toHaveBeenCalledOnce();
	});

	it("rate limits the ngrok-appended client address without trusting spoofed predecessors", async () => {
		const { origin } = await startRemoteHandler();
		const attempt = (forwardedFor: string) =>
			fetch(new URL("/confirm", origin), {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					"x-forwarded-for": forwardedFor,
				},
				body: new URLSearchParams({
					secret: "wrong-password",
				}),
			});

		for (let attemptNumber = 0; attemptNumber < 10; attemptNumber += 1)
			expect((await attempt(`198.51.100.${attemptNumber}, 203.0.113.10`)).status).toBe(401);
		expect((await attempt("192.0.2.200, 203.0.113.10")).status).toBe(429);
		expect((await attempt("192.0.2.200, 203.0.113.11")).status).toBe(401);
	});
});
