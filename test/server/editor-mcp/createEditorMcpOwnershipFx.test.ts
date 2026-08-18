import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorMcpOwnershipFx } from "../../../server/editor-mcp/createEditorMcpOwnershipFx";
import {
	createSqliteEditorProjectRepositoryFx,
	type SqliteEditorProjectRepository,
} from "../../../server/editor/createSqliteEditorProjectRepositoryFx";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

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

const connectClient = async (port: number, mode: "auto" | "legacy" = "auto") => {
	const client = new Client(
		{
			name: `arkini-editor-${mode}-test`,
			version: "1.0.0",
		},
		{
			versionNegotiation: {
				mode,
			},
		},
	);
	cleanups.push(() => client.close());
	await client.connect(
		new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/editor/mcp`)),
	);
	return client;
};

const createHarness = async (
	runPromise: createEditorMcpOwnershipFx.Props["runPromise"] = Effect.runPromise,
) => {
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
			runPromise,
		}),
	);
	cleanups.push(() => Effect.runPromise(ownership.closeFx));
	return {
		ownership,
		port,
		repository,
	};
};

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("createEditorMcpOwnershipFx", () => {
	it("starts once, binds only the editor endpoint, and releases its port", async () => {
		const { ownership, port } = await createHarness();
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
				port,
				type: "ready",
			},
			{
				port,
				type: "ready",
			},
		]);
		await expect(fetch(`http://127.0.0.1:${port}/other`)).resolves.toMatchObject({
			status: 404,
		});
		await expect(fetch(`http://127.0.0.1:${port}/mcp`)).resolves.toMatchObject({
			status: 404,
		});
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

	it("publishes the modern tool catalog and rejects calls without project context", async () => {
		const { ownership, port } = await createHarness();
		await Effect.runPromise(ownership.activateFx);
		const client = await connectClient(port);
		expect(client.getProtocolEra()).toBe("modern");
		expect(client.getServerVersion()).toMatchObject({
			name: "arkini-editor",
			version: ArkiniAppVersion,
		});
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toEqual([
			"project",
			"item_meta",
			"item_collection",
			"item_detail",
			"item_input",
			"item_output",
			"item_estimate",
		]);
		const collectionProperties = tools.tools.find(({ name }) => name === "item_collection")
			?.inputSchema.properties;
		if (collectionProperties === undefined)
			throw new Error("item_collection schema is missing.");
		expect(collectionProperties.itemTypes).toMatchObject({
			items: {
				enum: ItemEnumSchema.options,
				type: "string",
			},
			type: "array",
		});
		for (const toolName of [
			"item_input",
			"item_output",
		]) {
			const properties = tools.tools.find(({ name }) => name === toolName)?.inputSchema
				.properties;
			expect(properties).toHaveProperty("itemId");
			expect(properties).toHaveProperty("level");
		}
		expect(
			tools.tools.find(({ name }) => name === "item_estimate")?.inputSchema.properties,
		).toMatchObject({
			itemId: expect.any(Object),
			quantity: expect.any(Object),
		});
		const missing = await client.callTool({
			name: "project",
			arguments: {},
		});
		expect(missing).toMatchObject({
			isError: true,
			content: [
				{
					text: "Editor operation failed: No editor project is currently open. Open a project in Arkini before using editor tools.",
					type: "text",
				},
			],
		});
	});

	it("serves the active project and clears only the matching context", async () => {
		let runtimeCalls = 0;
		const runPromise: createEditorMcpOwnershipFx.Props["runPromise"] = (effect) => {
			runtimeCalls += 1;
			return Effect.runPromise(effect);
		};
		const { ownership, port, repository } = await createHarness(runPromise);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "project-context",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("project-context");
		ownership.clearProjectContext("another-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectClient(port);
		const project = await client.callTool({
			name: "project",
			arguments: {},
		});
		expect(project.content).toMatchObject([
			{
				text: expect.stringContaining("Project ID: project-context"),
			},
		]);
		expect(runtimeCalls).toBe(1);
		ownership.clearProjectContext("project-context");
		expect(ownership.readProjectContext()).toBeUndefined();
	});

	it("serves the same catalog through the legacy protocol era", async () => {
		const { ownership, port, repository } = await createHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "legacy-project",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("legacy-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectClient(port, "legacy");
		expect(client.getProtocolEra()).toBe("legacy");
		expect((await client.listTools()).tools.map(({ name }) => name)).toContain("item_estimate");
		expect(
			(
				await client.callTool({
					name: "project",
					arguments: {},
				})
			).content,
		).toMatchObject([
			{
				text: expect.stringContaining("Project ID: legacy-project"),
			},
		]);
	});

	it("routes relation and estimate requests through the active project", async () => {
		const { ownership, port, repository } = await createHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "tool-project",
				config: createJobTestConfig(),
				resources: [],
			}),
		);
		ownership.setProjectContext("tool-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectClient(port);
		const relation = await client.callTool({
			name: "item_input",
			arguments: {
				itemId: "water",
				level: 2,
			},
		});
		const estimate = await client.callTool({
			name: "item_estimate",
			arguments: {
				itemId: "tool",
			},
		});

		expect(relation.isError).not.toBe(true);
		expect(relation).not.toHaveProperty("structuredContent");
		expect(relation.content).toMatchObject([
			{
				text: expect.stringContaining("Item input\nItem ID: water"),
			},
		]);
		expect(estimate.isError).not.toBe(true);
		expect(estimate).not.toHaveProperty("structuredContent");
		expect(estimate.content).toMatchObject([
			{
				text: expect.stringContaining("Item estimate\nItem ID: tool"),
			},
		]);
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
				runPromise: Effect.runPromise,
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
				runPromise: Effect.runPromise,
			}),
		);
		expect(Effect.runSync(ownership.activateFx)).toEqual({
			type: "unavailable",
			message: "SQLite failed.",
		});
	});
});
