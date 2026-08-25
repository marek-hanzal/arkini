import { request as requestHttp } from "node:http";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSqliteEditorMcpAuthOwnershipFx } from "../../../../electron/main/editor-mcp/auth/createSqliteEditorMcpAuthOwnershipFx";
import { createEditorMcpOwnershipFx } from "../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import type { EditorMcpTunnel } from "../../../../electron/main/editor-mcp/tunnel/EditorMcpTunnel";
import { EditorMcpTunnelProvenanceHeader } from "../../../../electron/main/editor-mcp/tunnel/EditorMcpTunnelProvenanceHeader";
import { createSqliteEditorProjectRepositoryFx } from "../../../../electron/main/editor-project/sqlite/fx/createSqliteEditorProjectRepositoryFx";
import { reserveReleasedEditorMcpPort } from "./support/createEditorMcpHarness";

const cleanups: Array<() => Promise<void>> = [];

const requestPublicLocalEndpoint = (port: number) =>
	new Promise<number | undefined>((resolve, reject) => {
		const request = requestHttp(
			{
				host: "127.0.0.1",
				port,
				path: "/editor/mcp",
				headers: {
					host: "stable-example.ngrok-free.app",
				},
			},
			(response) => {
				response.resume();
				response.once("end", () => resolve(response.statusCode));
			},
		);
		request.once("error", reject);
		request.end();
	});

const requestTunneledLocalEndpoint = (port: number, provenance: string) =>
	new Promise<number | undefined>((resolve, reject) => {
		const request = requestHttp(
			{
				host: "127.0.0.1",
				port,
				path: "/editor/mcp",
				headers: {
					host: "localhost",
					[EditorMcpTunnelProvenanceHeader]: provenance,
				},
			},
			(response) => {
				response.resume();
				response.once("end", () => resolve(response.statusCode));
			},
		);
		request.once("error", reject);
		request.end();
	});

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const createRemoteOwnership = async (
	checkRemoteFx: createEditorMcpOwnershipFx.Props["checkRemoteFx"] = () => Effect.void,
) => {
	const repository = await Effect.runPromise(
		createSqliteEditorProjectRepositoryFx({
			databasePath: ":memory:",
		}),
	);
	cleanups.push(() => Effect.runPromise(repository.closeFx));
	const auth = Effect.runSync(
		createSqliteEditorMcpAuthOwnershipFx({
			databasePath: ":memory:",
		}),
	);
	let domain: string | undefined;
	const port = await reserveReleasedEditorMcpPort();
	const opened: Array<{
		readonly authtoken: string;
		readonly domain?: string;
		readonly provenance: string;
	}> = [];
	const closeTunnel = vi.fn();
	const tunnel: EditorMcpTunnel = {
		openFx: (options) =>
			Effect.sync(() => {
				opened.push(options);
				let finish: () => void = () => undefined;
				const joined = new Promise<void>((resolve) => {
					finish = resolve;
				});
				return {
					url: new URL("https://stable-example.ngrok-free.app"),
					joinFx: Effect.promise(() => joined),
					closeFx: Effect.sync(() => {
						closeTunnel();
						finish();
					}),
				};
			}),
	};
	const ownership = Effect.runSync(
		createEditorMcpOwnershipFx({
			auth,
			checkRemoteFx,
			editor: {
				type: "ready",
				repository,
			},
			notifyOverviewChanged: () => undefined,
			notifyProjectChanged: () => undefined,
			preferences: {
				readPortFx: Effect.succeed(port),
				writePortFx: () => Effect.void,
				readNgrokAuthtokenFx: Effect.succeed("ngrok-token"),
				writeNgrokAuthtokenFx: () => Effect.void,
				readNgrokDomainFx: Effect.sync(() => domain),
				writeNgrokDomainFx: (value) => Effect.sync(() => void (domain = value)),
				clearNgrokDomainFx: Effect.sync(() => void (domain = undefined)),
			},
			runPromise: Effect.runPromise,
			tunnel,
		}),
	);
	cleanups.push(() => Effect.runPromise(ownership.closeFx));
	return {
		auth,
		closeTunnel,
		opened,
		ownership,
		port,
		readDomain: () => domain,
	};
};

describe("Remote Editor MCP ownership", () => {
	it("shares one listener while keeping local and remote lifecycle independent", async () => {
		const { auth, closeTunnel, opened, ownership, port, readDomain } =
			await createRemoteOwnership();
		const remote = await Effect.runPromise(ownership.startRemoteFx);
		if (remote.secret === undefined) throw new Error("Expected the initial Remote password.");
		expect(remote.overview).toMatchObject({
			local: {
				type: "inactive",
			},
			remote: {
				type: "ready",
				url: "https://stable-example.ngrok-free.app/remote/mcp",
			},
		});
		expect(readDomain()).toBe("stable-example.ngrok-free.app");
		expect(await fetch(`http://127.0.0.1:${port}/editor/mcp`)).toMatchObject({
			status: 404,
		});
		expect(await fetch(`http://127.0.0.1:${port}/remote/mcp`)).toMatchObject({
			status: 404,
		});
		expect(await requestTunneledLocalEndpoint(port, opened[0]?.provenance ?? "")).toBe(404);

		await Effect.runPromise(ownership.startLocalFx);
		expect((await fetch(`http://127.0.0.1:${port}/editor/mcp`)).status).not.toBe(404);
		expect(await requestPublicLocalEndpoint(port)).toBe(403);
		await Effect.runPromise(ownership.stopRemoteFx);
		expect(closeTunnel).toHaveBeenCalledOnce();
		expect(await requestTunneledLocalEndpoint(port, opened[0]?.provenance ?? "")).toBe(404);
		expect((await fetch(`http://127.0.0.1:${port}/editor/mcp`)).status).not.toBe(404);
		await Effect.runPromise(ownership.startRemoteFx);
		expect(opened.at(-1)).toMatchObject({
			domain: "stable-example.ngrok-free.app",
		});

		const reset = await Effect.runPromise(ownership.resetRemoteAuthFx);
		expect(reset.secret).not.toBe(remote.secret);
		expect(await Effect.runPromise(auth.verifySecretFx(remote.secret))).toBe(false);
		expect(readDomain()).toBeUndefined();
	});

	it("preserves generated auth after an ordinary tunnel health failure", async () => {
		let failHealthCheck = true;
		const { auth, ownership } = await createRemoteOwnership(() =>
			failHealthCheck ? Effect.fail(new Error("public endpoint unavailable")) : Effect.void,
		);
		const failed = await Effect.runPromise(ownership.startRemoteFx);
		if (failed.secret === undefined) throw new Error("Expected the initial Remote password.");
		expect(failed.overview.remote.type).toBe("unavailable");
		expect(await Effect.runPromise(auth.verifySecretFx(failed.secret))).toBe(true);

		failHealthCheck = false;
		const recovered = await Effect.runPromise(ownership.startRemoteFx);
		expect(recovered.overview.remote.type).toBe("ready");
		expect(recovered.secret).toBeUndefined();
	});
});
