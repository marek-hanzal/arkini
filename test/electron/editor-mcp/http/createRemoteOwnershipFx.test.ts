import { request as requestHttp } from "node:http";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorMcpOwnershipFx } from "~electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import type { McpTunnel } from "~electron/main/editor-mcp/tunnel/McpTunnel";
import { TunnelProvenanceHeader } from "~electron/main/editor-mcp/tunnel/TunnelProvenanceHeader";
import {
	createProjectRepository,
	createTestStorage,
	reserveReleasedPort,
} from "./support/createMcpHarness";

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
					[TunnelProvenanceHeader]: provenance,
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
	const repository = await createProjectRepository((cleanup) => cleanups.push(cleanup));
	const port = await reserveReleasedPort();
	const storage = await createTestStorage(port, {
		authtoken: "ngrok-token",
		domain: "stable-example.ngrok-free.app",
	});
	const opened: Array<{
		readonly authtoken: string;
		readonly domain: string;
		readonly provenance: string;
	}> = [];
	const closeTunnel = vi.fn();
	let disconnectTunnel: () => void = () => undefined;
	const tunnel: McpTunnel = {
		openFx: (options) =>
			Effect.sync(() => {
				opened.push(options);
				let finish: () => void = () => undefined;
				const joined = new Promise<void>((resolve) => {
					finish = resolve;
				});
				disconnectTunnel = finish;
				return {
					url: new URL(`https://${options.domain}`),
					closedFx: Effect.promise(() => joined),
					closeFx: Effect.sync(() => {
						closeTunnel();
						finish();
					}),
				};
			}),
	};
	const ownership = Effect.runSync(
		createEditorMcpOwnershipFx({
			checkRemoteFx,
			editor: {
				type: "ready",
				repository,
			},
			notifyOverviewChanged: () => undefined,
			notifyProjectChanged: () => undefined,
			storage,
			runPromise: Effect.runPromise,
			tunnel,
		}),
	);
	cleanups.push(() => Effect.runPromise(ownership.closeFx));
	return {
		storage,
		closeTunnel,
		disconnectTunnel: () => disconnectTunnel(),
		opened,
		ownership,
		port,
	};
};

describe("Remote Editor MCP ownership", () => {
	it("publishes an unexpected tunnel disconnect and releases its listener", async () => {
		const { closeTunnel, disconnectTunnel, ownership, port } = await createRemoteOwnership();
		await Effect.runPromise(ownership.startRemoteFx);

		disconnectTunnel();

		await expect
			.poll(async () => (await Effect.runPromise(ownership.readOverviewFx)).remote.type)
			.toBe("unavailable");
		expect(closeTunnel).toHaveBeenCalledOnce();
		await expect(fetch(`http://127.0.0.1:${port}/editor/mcp`)).rejects.toThrow();
	});

	it("shares one listener while keeping local and remote lifecycle independent", async () => {
		const { storage, closeTunnel, opened, ownership, port } = await createRemoteOwnership();
		const remote = await Effect.runPromise(ownership.startRemoteFx);
		const remotePassword = remote.overview.remotePassword;
		expect(remote.overview).toMatchObject({
			local: {
				type: "inactive",
			},
			remote: {
				type: "ready",
				url: "https://stable-example.ngrok-free.app/remote/mcp",
			},
		});
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
		const restarted = await Effect.runPromise(ownership.startRemoteFx);
		expect(restarted.overview.remote).toEqual({
			type: "ready",
			url: "https://stable-example.ngrok-free.app/remote/mcp",
		});
		expect(opened).toHaveLength(2);
		expect(opened.every(({ domain }) => domain === "stable-example.ngrok-free.app")).toBe(true);

		const reset = await Effect.runPromise(ownership.resetRemoteAuthFx);
		expect(reset.overview.remotePassword).not.toBe(remotePassword);
		expect(await Effect.runPromise(storage.verifySecretFx(remotePassword))).toBe(false);
	});

	it("preserves generated auth after an ordinary tunnel health failure", async () => {
		let failHealthCheck = true;
		const { storage, ownership } = await createRemoteOwnership(() =>
			failHealthCheck ? Effect.fail(new Error("public endpoint unavailable")) : Effect.void,
		);
		const failed = await Effect.runPromise(ownership.startRemoteFx);
		const remotePassword = failed.overview.remotePassword;
		expect(failed.overview.remote.type).toBe("unavailable");
		expect(await Effect.runPromise(storage.verifySecretFx(remotePassword))).toBe(true);

		failHealthCheck = false;
		const recovered = await Effect.runPromise(ownership.startRemoteFx);
		expect(recovered.overview.remote.type).toBe("ready");
		expect(recovered.overview.remotePassword).toBe(remotePassword);
	});
});
