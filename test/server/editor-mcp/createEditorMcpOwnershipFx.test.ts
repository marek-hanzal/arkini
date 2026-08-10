import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorMcpOwnershipFx } from "../../../server/editor-mcp/createEditorMcpOwnershipFx";
import {
	createSqliteEditorProjectRepositoryFx,
	type SqliteEditorProjectRepository,
} from "../../../server/editor/createSqliteEditorProjectRepositoryFx";

const cleanups: Array<() => Promise<void> | void> = [];

const reserveReleasedPort = () =>
	new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				reject(new Error("Expected an ephemeral TCP port."));
				return;
			}
			server.close((error) => (error === undefined ? resolve(address.port) : reject(error)));
		});
	});

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("createEditorMcpOwnershipFx", () => {
	it("starts lazily once and serves modern MCP tools on loopback", async () => {
		const repository: SqliteEditorProjectRepository = await Effect.runPromise(
			createSqliteEditorProjectRepositoryFx({
				databasePath: ":memory:",
			}),
		);
		cleanups.push(() => Effect.runPromise(repository.closeFx));
		const port = await reserveReleasedPort();
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				editor: {
					type: "ready",
					repository,
				},
				readPortFx: Effect.succeed(port),
			}),
		);
		cleanups.push(() => Effect.runPromise(ownership.closeFx));

		expect(ownership.readStatus()).toEqual({
			type: "inactive",
		});
		await expect(
			Promise.all([
				Effect.runPromise(ownership.activateFx),
				Effect.runPromise(ownership.activateFx),
			]),
		).resolves.toEqual([
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

		const client = new Client(
			{
				name: "arkini-editor-test",
				version: "1.0.0",
			},
			{
				versionNegotiation: {
					mode: "auto",
				},
			},
		);
		cleanups.push(() => client.close());
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
		);
		expect(client.getProtocolEra()).toBe("modern");
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toContain("editor_list_projects");
		const result = await client.callTool({
			name: "editor_list_projects",
			arguments: {},
		});
		expect(result.content).toEqual([
			{
				type: "text",
				text: "No editor projects.",
			},
		]);
		const legacyClient = new Client(
			{
				name: "arkini-editor-legacy-test",
				version: "1.0.0",
			},
			{
				versionNegotiation: {
					mode: "legacy",
				},
			},
		);
		cleanups.push(() => legacyClient.close());
		await legacyClient.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
		);
		expect(legacyClient.getProtocolEra()).toBe("legacy");
		expect((await legacyClient.listTools()).tools.map(({ name }) => name)).toContain(
			"editor_list_projects",
		);
		expect(
			(
				await legacyClient.callTool({
					name: "editor_list_projects",
					arguments: {},
				})
			).content,
		).toEqual([
			{
				type: "text",
				text: "No editor projects.",
			},
		]);
		await client.close();
		await legacyClient.close();
		await Effect.runPromise(ownership.closeFx);
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
		cleanups.push(
			() =>
				new Promise<void>((resolve, reject) =>
					occupied.close((error) => (error === undefined ? resolve() : reject(error))),
				),
		);
		const repository = await Effect.runPromise(
			createSqliteEditorProjectRepositoryFx({
				databasePath: ":memory:",
			}),
		);
		cleanups.push(() => Effect.runPromise(repository.closeFx));
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				editor: {
					type: "ready",
					repository,
				},
				readPortFx: Effect.succeed(port),
			}),
		);
		const status = await Effect.runPromise(ownership.activateFx);
		expect(status.type).toBe("unavailable");
		if (status.type === "unavailable") expect(status.message).toContain("EADDRINUSE");
		expect(occupied.listening).toBe(true);
	});

	it("stays unavailable without binding when editor persistence failed", () => {
		const ownership = Effect.runSync(
			createEditorMcpOwnershipFx({
				editor: {
					type: "unavailable",
					message: "SQLite failed.",
				},
				readPortFx: Effect.die("must not read"),
			}),
		);
		expect(Effect.runSync(ownership.activateFx)).toEqual({
			type: "unavailable",
			message: "SQLite failed.",
		});
	});
});
