import { createServer } from "node:http";
import { connect } from "node:net";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorMcpOwnershipFx } from "../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import {
	cleanupEditorMcpHarnesses,
	createEditorMcpHarness,
	createEditorMcpProjectRepository,
	createTestEditorMcpStorage,
	registerEditorMcpCleanup,
	reserveReleasedEditorMcpPort,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

const sendRawRequest = (port: number, target: string) =>
	new Promise<string>((resolve, reject) => {
		const socket = connect(port, "127.0.0.1");
		let response = "";
		socket.setEncoding("utf8");
		socket.once("error", reject);
		socket.on("data", (chunk) => {
			response += chunk;
		});
		socket.once("end", () => resolve(response));
		socket.once("connect", () => {
			socket.end(
				`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`,
			);
		});
	});

const createOwnership = async (
	port: number,
	editor: createEditorMcpOwnershipFx.Props["editor"],
) => {
	const storage = await createTestEditorMcpStorage(port);
	const ownership = Effect.runSync(
		createEditorMcpOwnershipFx({
			editor,
			notifyOverviewChanged: () => undefined,
			notifyProjectChanged: () => undefined,
			storage,
			runPromise: Effect.runPromise,
			tunnel: {
				openFx: () => Effect.fail(new Error("Unexpected Remote MCP tunnel start.")),
			},
		}),
	);
	registerEditorMcpCleanup(() => Effect.runPromise(ownership.closeFx));
	return ownership;
};

describe("createEditorMcpOwnershipFx", () => {
	it("starts local MCP explicitly once, stops it, and releases its port", async () => {
		const { ownership, port } = await createEditorMcpHarness();
		expect(ownership.readLocalStatus()).toEqual({
			type: "inactive",
		});
		await expect(fetch(`http://127.0.0.1:${port}/editor/mcp`)).rejects.toThrow();

		const starts = await Promise.all([
			Effect.runPromise(ownership.startLocalFx),
			Effect.runPromise(ownership.startLocalFx),
		]);
		expect(starts.map(({ overview }) => overview.local)).toEqual([
			{
				type: "ready",
				port,
			},
			{
				type: "ready",
				port,
			},
		]);
		await expect(fetch(`http://127.0.0.1:${port}/other`)).resolves.toMatchObject({
			status: 404,
		});
		await expect(fetch(`http://127.0.0.1:${port}/mcp`)).resolves.toMatchObject({
			status: 404,
		});
		expect(await sendRawRequest(port, "//[")).toMatch(/^HTTP\/1\.1 400/);
		await expect(fetch(`http://127.0.0.1:${port}/other`)).resolves.toMatchObject({
			status: 404,
		});

		await Effect.runPromise(ownership.stopLocalFx);
		const released = createServer();
		await new Promise<void>((resolve, reject) => {
			released.once("error", reject);
			released.listen(port, "127.0.0.1", resolve);
		});
		await new Promise<void>((resolve, reject) =>
			released.close((error) => (error === undefined ? resolve() : reject(error))),
		);
	});

	it("reports an occupied configured port without stealing the listener", async () => {
		const occupied = createServer();
		const port = await new Promise<number>((resolve, reject) => {
			occupied.once("error", reject);
			occupied.listen(0, "127.0.0.1", () => {
				const address = occupied.address();
				if (address === null || typeof address === "string") {
					reject(new Error("Expected occupied TCP port."));
					return;
				}
				resolve(address.port);
			});
		});
		registerEditorMcpCleanup(
			() =>
				new Promise<void>((resolve, reject) =>
					occupied.close((error) => (error === undefined ? resolve() : reject(error))),
				),
		);
		const repository = await createEditorMcpProjectRepository();
		const ownership = await createOwnership(port, {
			type: "ready",
			repository,
		});

		const result = await Effect.runPromise(ownership.startLocalFx);
		expect(result.overview.local).toMatchObject({
			type: "unavailable",
		});
		if (result.overview.local.type === "unavailable")
			expect(result.overview.local.message).toContain("EADDRINUSE");
		expect(occupied.listening).toBe(true);
	});

	it("stays unavailable without binding when editor persistence failed", async () => {
		const ownership = await createOwnership(32_310, {
			type: "unavailable",
			message: "Editor storage failed.",
		});

		await expect(Effect.runPromise(ownership.startLocalFx)).resolves.toMatchObject({
			overview: {
				local: {
					type: "unavailable",
				},
			},
		});
	});

	it("serializes a port change before a concurrent local start", async () => {
		const originalPort = await reserveReleasedEditorMcpPort();
		let replacementPort = await reserveReleasedEditorMcpPort();
		while (replacementPort === originalPort)
			replacementPort = await reserveReleasedEditorMcpPort();
		const repository = await createEditorMcpProjectRepository();
		const storage = await createTestEditorMcpStorage(originalPort);
		let currentPort = originalPort;
		let releaseWrite: () => void = () => undefined;
		const writeMayFinish = new Promise<void>((resolve) => {
			releaseWrite = resolve;
		});
		let announceWrite: () => void = () => undefined;
		const writeStarted = new Promise<void>((resolve) => {
			announceWrite = resolve;
		});
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				checkPortFx: () =>
					Effect.succeed({
						type: "available" as const,
					}),
				editor: {
					type: "ready",
					repository,
				},
				notifyOverviewChanged: () => undefined,
				notifyProjectChanged: () => undefined,
				storage: {
					...storage,
					readPortFx: Effect.sync(() => currentPort),
					writePortFx: (port) =>
						Effect.promise(async () => {
							announceWrite();
							await writeMayFinish;
							currentPort = port;
						}),
				},
				runPromise: Effect.runPromise,
				tunnel: {
					openFx: () => Effect.fail(new Error("Unexpected Remote MCP tunnel start.")),
				},
			}),
		);
		registerEditorMcpCleanup(() => Effect.runPromise(ownership.closeFx));

		const configure = Effect.runPromise(
			ownership.configureFx({
				type: "port",
				port: replacementPort,
			}),
		);
		await writeStarted;
		const start = Effect.runPromise(ownership.startLocalFx);
		releaseWrite();

		await configure;
		expect((await start).overview.local).toEqual({
			type: "ready",
			port: replacementPort,
		});
		await expect(
			fetch(`http://127.0.0.1:${replacementPort}/editor/mcp`),
		).resolves.not.toMatchObject({
			status: 404,
		});
		await expect(fetch(`http://127.0.0.1:${originalPort}/editor/mcp`)).rejects.toThrow();
	});
});
