import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import type { AccessToken, AuthorizationCode, RefreshToken } from "mcp-oauth-server";
import { afterEach, describe, expect, it } from "vitest";

import {
	createFilesystemEditorMcpStorageFx,
	DefaultPort,
} from "~electron/main/editor-mcp/storage/createFilesystemEditorMcpStorageFx";

const directories: string[] = [];

afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, {
			recursive: true,
			force: true,
		});
});

const createStorage = () => {
	const directory = mkdtempSync(join(tmpdir(), "arkini-mcp-storage-test-"));
	directories.push(directory);
	const root = join(directory, "editor");
	return Effect.runPromise(
		createFilesystemEditorMcpStorageFx({
			root,
		}),
	).then((storage) => ({
		directory,
		root,
		storage,
	}));
};

const authorizationCode = (): AuthorizationCode => ({
	authorizationCode: "authorization-code",
	clientId: "client-one",
	userId: "arkini-owner",
	expiresAt: new Date(Date.now() + 60_000),
	codeChallenge: "challenge",
	redirectUri: "http://127.0.0.1/callback",
	scopes: [
		"editor:mcp",
	],
});

const refreshToken = (): RefreshToken => ({
	token: "refresh-token",
	expiresAt: new Date(Date.now() + 60_000),
	scopes: [
		"editor:mcp",
	],
	clientId: "client-one",
	userId: "arkini-owner",
});

describe("createFilesystemEditorMcpStorageFx", () => {
	it("retains concurrent OAuth updates from distinct storage instances", async () => {
		const first = await createStorage();
		await Effect.runPromise(first.storage.ensureSecretFx);
		const second = await Effect.runPromise(
			createFilesystemEditorMcpStorageFx({
				root: first.root,
			}),
		);
		await Promise.all([
			first.storage.model.registerClient?.({
				client_id: "client-left",
				redirect_uris: [
					"http://127.0.0.1/left",
				],
			} as never),
			second.model.registerClient?.({
				client_id: "client-right",
				redirect_uris: [
					"http://127.0.0.1/right",
				],
			} as never),
		]);

		const stored = JSON.parse(readFileSync(join(first.root, "mcp.json"), "utf8")) as {
			readonly clients: ReadonlyArray<{
				readonly client_id: string;
			}>;
		};
		expect(stored.clients.map(({ client_id }) => client_id).sort()).toEqual([
			"client-left",
			"client-right",
		]);
	});

	it("persists all MCP state in one local file", async () => {
		const first = await createStorage();
		const configured = first.storage;
		expect(await Effect.runPromise(configured.readPortFx)).toBe(DefaultPort);
		await Effect.runPromise(configured.writePortFx(45_678));
		await Effect.runPromise(
			configured.writeNgrokFx({
				authtoken: "ngrok-secret-token",
				domain: "mcp.example.com",
			}),
		);
		const password = await Effect.runPromise(configured.ensureSecretFx);
		await configured.model.registerClient?.({
			client_id: "client-one",
			redirect_uris: [
				"http://127.0.0.1/callback",
			],
		} as never);
		const accessToken: AccessToken = {
			token: "access-token",
			expiresAt: new Date(Date.now() + 60_000),
			scopes: [
				"editor:mcp",
			],
			clientId: "client-one",
		};
		await configured.model.saveAccessToken(accessToken, {} as never);

		const reopened = await Effect.runPromise(
			createFilesystemEditorMcpStorageFx({
				root: first.root,
			}),
		);
		expect(await Effect.runPromise(reopened.readPortFx)).toBe(45_678);
		expect(await Effect.runPromise(reopened.readNgrokFx)).toEqual({
			authtoken: "ngrok-secret-token",
			domain: "mcp.example.com",
		});
		expect(await Effect.runPromise(reopened.ensureSecretFx)).toBe(password);
		expect(await reopened.model.getClient("client-one")).toBeDefined();
		expect(await reopened.model.getAccessToken("access-token")).toMatchObject(accessToken);
		expect((await reopened.model.getAccessToken("access-token"))?.expiresAt).toBeInstanceOf(
			Date,
		);

		const path = join(first.root, "mcp.json");
		const raw = readFileSync(path, "utf8");
		expect(raw).toContain("ngrok-secret-token");
		expect(JSON.parse(raw)).toMatchObject({
			ngrok: {
				authtoken: "ngrok-secret-token",
			},
		});
	});

	it("resets OAuth state and password while preserving transport configuration", async () => {
		const { storage } = await createStorage();
		await Effect.runPromise(storage.writePortFx(45_678));
		await Effect.runPromise(
			storage.writeNgrokFx({
				authtoken: "ngrok-secret-token",
				domain: "mcp.example.com",
			}),
		);
		const original = await Effect.runPromise(storage.ensureSecretFx);
		await storage.model.registerClient?.({
			client_id: "client-one",
			redirect_uris: [
				"http://127.0.0.1/callback",
			],
		} as never);
		await storage.model.saveRefreshToken(refreshToken(), {} as never);

		const replacement = await Effect.runPromise(storage.resetFx);
		expect(replacement).not.toBe(original);
		expect(await Effect.runPromise(storage.verifySecretFx(original))).toBe(false);
		expect(await Effect.runPromise(storage.verifySecretFx(replacement))).toBe(true);
		expect(await Effect.runPromise(storage.readPortFx)).toBe(45_678);
		expect(await Effect.runPromise(storage.readNgrokFx)).toEqual({
			authtoken: "ngrok-secret-token",
			domain: "mcp.example.com",
		});
		expect(await storage.model.getClient("client-one")).toBeUndefined();
		expect(
			await storage.model.consumeRefreshToken?.("refresh-token", "client-one"),
		).toBeUndefined();
	});

	it("rejects incomplete persisted OAuth identities instead of indexing undefined keys", async () => {
		const first = await createStorage();
		await Effect.runPromise(first.storage.ensureSecretFx);
		const path = join(first.root, "mcp.json");
		const stored = JSON.parse(readFileSync(path, "utf8"));
		stored.accessTokens = [
			{
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
				scopes: [
					"editor:mcp",
				],
				clientId: "client-one",
			},
		];
		writeFileSync(path, JSON.stringify(stored));

		const reopened = await Effect.runPromise(
			createFilesystemEditorMcpStorageFx({
				root: first.root,
			}),
		);

		expect(await reopened.model.getAccessToken("undefined")).toBeUndefined();
		expect(JSON.parse(readFileSync(path, "utf8")).accessTokens).toEqual([]);
	});

	it("consumes authorization codes and refresh tokens once without cross-client invalidation", async () => {
		const { storage } = await createStorage();
		await storage.model.saveAuthorizationCode?.(authorizationCode(), {} as never);
		expect(
			await storage.model.consumeAuthorizationCode?.("authorization-code", "client-two"),
		).toBeUndefined();
		const authorizationResults = await Promise.all([
			storage.model.consumeAuthorizationCode?.("authorization-code", "client-one"),
			storage.model.consumeAuthorizationCode?.("authorization-code", "client-one"),
		]);
		expect(authorizationResults.filter((result) => result !== undefined)).toHaveLength(1);

		await storage.model.saveRefreshToken(refreshToken(), {} as never);
		expect(
			await storage.model.consumeRefreshToken?.("refresh-token", "client-two"),
		).toBeUndefined();
		const refreshResults = await Promise.all([
			storage.model.consumeRefreshToken?.("refresh-token", "client-one"),
			storage.model.consumeRefreshToken?.("refresh-token", "client-one"),
		]);
		expect(refreshResults.filter((result) => result !== undefined)).toHaveLength(1);
	});

	it("revokes access and refresh tokens only for the selected grant", async () => {
		const { storage } = await createStorage();
		const createAccessToken = (token: string, grantId: string): AccessToken => ({
			token,
			expiresAt: new Date(Date.now() + 60_000),
			scopes: [
				"editor:mcp",
			],
			clientId: "client-one",
			grantId,
		});
		await storage.model.saveAccessToken(
			createAccessToken("removed-access", "removed"),
			{} as never,
		);
		await storage.model.saveAccessToken(createAccessToken("kept-access", "kept"), {} as never);
		await storage.model.saveRefreshToken(
			{
				...refreshToken(),
				token: "removed-refresh",
				grantId: "removed",
			},
			{} as never,
		);

		await storage.model.revokeGrant("removed");

		expect(await storage.model.getAccessToken("removed-access")).toBeUndefined();
		expect(await storage.model.getAccessToken("kept-access")).toBeDefined();
		expect(
			await storage.model.consumeRefreshToken?.("removed-refresh", "client-one"),
		).toBeUndefined();
	});
});
