import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import type { AuthorizationCode, RefreshToken } from "mcp-oauth-server";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteEditorMcpAuthOwnershipFx } from "../../../../electron/main/editor-mcp/auth/createSqliteEditorMcpAuthOwnershipFx";

const directories: string[] = [];

afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, {
			recursive: true,
			force: true,
		});
});

const createDatabasePath = () => {
	const directory = mkdtempSync(join(tmpdir(), "arkini-mcp-auth-test-"));
	directories.push(directory);
	return join(directory, "auth.sqlite");
};

describe("createSqliteEditorMcpAuthOwnershipFx", () => {
	it("persists one generated password and replaces it only on explicit reset", async () => {
		const databasePath = createDatabasePath();
		const first = Effect.runSync(
			createSqliteEditorMcpAuthOwnershipFx({
				databasePath,
			}),
		);
		const original = await Effect.runPromise(first.ensureSecretFx);
		expect(original).toMatch(/^arkini_mcp_[a-z0-9]+$/);
		expect(statSync(databasePath).mode & 0o777).toBe(0o600);
		expect(await Effect.runPromise(first.ensureSecretFx)).toBe(original);
		expect(await Effect.runPromise(first.verifySecretFx(original))).toBe(true);
		await Effect.runPromise(first.closeFx);

		const reopened = Effect.runSync(
			createSqliteEditorMcpAuthOwnershipFx({
				databasePath,
			}),
		);
		expect(await Effect.runPromise(reopened.ensureSecretFx)).toBe(original);
		expect(await Effect.runPromise(reopened.verifySecretFx(original))).toBe(true);
		const replacement = await Effect.runPromise(reopened.resetFx);
		expect(replacement).not.toBe(original);
		expect(await Effect.runPromise(reopened.verifySecretFx(original))).toBe(false);
		expect(await Effect.runPromise(reopened.verifySecretFx(replacement))).toBe(true);
		await Effect.runPromise(reopened.closeFx);
	});

	it("consumes authorization codes and refresh tokens once without cross-client invalidation", async () => {
		const ownership = Effect.runSync(
			createSqliteEditorMcpAuthOwnershipFx({
				databasePath: createDatabasePath(),
			}),
		);
		const authorizationCode: AuthorizationCode = {
			authorizationCode: "authorization-code",
			clientId: "client-one",
			userId: "arkini-owner",
			expiresAt: new Date(Date.now() + 60_000),
			codeChallenge: "challenge",
			redirectUri: "http://127.0.0.1/callback",
			scopes: [
				"editor:mcp",
			],
		};
		await ownership.model.saveAuthorizationCode?.(authorizationCode, {} as never);
		expect(
			await ownership.model.consumeAuthorizationCode?.("authorization-code", "client-two"),
		).toBeUndefined();
		const authorizationResults = await Promise.all([
			ownership.model.consumeAuthorizationCode?.("authorization-code", "client-one"),
			ownership.model.consumeAuthorizationCode?.("authorization-code", "client-one"),
		]);
		expect(authorizationResults.filter((result) => result !== undefined)).toHaveLength(1);

		const refreshToken: RefreshToken = {
			token: "refresh-token",
			expiresAt: new Date(Date.now() + 60_000),
			scopes: [
				"editor:mcp",
			],
			clientId: "client-one",
			userId: "arkini-owner",
		};
		await ownership.model.saveRefreshToken(refreshToken, {} as never);
		expect(
			await ownership.model.consumeRefreshToken?.("refresh-token", "client-two"),
		).toBeUndefined();
		const refreshResults = await Promise.all([
			ownership.model.consumeRefreshToken?.("refresh-token", "client-one"),
			ownership.model.consumeRefreshToken?.("refresh-token", "client-one"),
		]);
		expect(refreshResults.filter((result) => result !== undefined)).toHaveLength(1);
		await Effect.runPromise(ownership.closeFx);
	});
});
