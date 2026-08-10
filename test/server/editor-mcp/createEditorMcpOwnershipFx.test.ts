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
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

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
		await expect(fetch(`http://127.0.0.1:${port}/mcp`)).resolves.toMatchObject({
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
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/editor/mcp`)),
		);
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
			"item_income",
			"item_outcome",
		]);
		expect(tools.tools.find(({ name }) => name === "project")?.inputSchema.properties).toEqual(
			{},
		);
		expect(
			tools.tools.find(({ name }) => name === "item_meta")?.inputSchema.properties,
		).toEqual({});
		expect(
			tools.tools.find(({ name }) => name === "item_collection")?.inputSchema.properties,
		).toHaveProperty("query");
		expect(
			tools.tools.find(({ name }) => name === "item_collection")?.inputSchema.properties,
		).toHaveProperty("itemTypes");
		expect(
			tools.tools.find(({ name }) => name === "item_collection")?.inputSchema.properties,
		).toHaveProperty("page");
		expect(
			tools.tools.find(({ name }) => name === "item_collection")?.inputSchema.properties,
		).toHaveProperty("pageSize");
		expect(
			tools.tools.find(({ name }) => name === "item_detail")?.inputSchema.properties,
		).toHaveProperty("id");
		for (const toolName of [
			"item_income",
			"item_outcome",
		]) {
			const properties = tools.tools.find(({ name }) => name === toolName)?.inputSchema
				.properties;
			expect(properties).toHaveProperty("itemId");
			expect(properties).toHaveProperty("level");
		}
		const missingContext = await client.callTool({
			name: "project",
			arguments: {},
		});
		expect(missingContext).toMatchObject({
			isError: true,
		});
		expect(missingContext.content).toEqual([
			{
				type: "text",
				text: "Editor operation failed: No editor project is currently open. Open a project in Arkini before using editor tools.",
			},
		]);
		const projectId = "project-context";
		await Effect.runPromise(
			repository.createProjectFx({
				projectId,
				config: {
					...editorTestPayload.config,
					items: {
						water: {
							...editorTestPayload.config.items.water,
							description: "Water\nKeeps the factory flowing.",
							maxCount: 42,
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext(projectId);
		expect(ownership.readProjectContext()).toBe(projectId);
		const project = await client.callTool({
			name: "project",
			arguments: {},
		});
		expect(project.isError).not.toBe(true);
		expect(project.content).toEqual([
			{
				type: "text",
				text: [
					"Title: Editor test",
					`Project ID: ${projectId}`,
					"Game ID: editor-test",
					"Config version: 1.0",
					"Revision: 0",
					"Board: 2 × 2",
					"Toolbar: disabled",
					"Inventory: 1 × 1",
					"Hero asset: hero",
					"Items: 1",
					"Resources: 2",
				].join("\n"),
			},
		]);
		const itemMeta = await client.callTool({
			name: "item_meta",
			arguments: {},
		});
		expect(itemMeta.content).toEqual([
			{
				type: "text",
				text: "Total: 1\nsimple: 1",
			},
		]);
		const itemCollection = await client.callTool({
			name: "item_collection",
			arguments: {},
		});
		expect(itemCollection.content).toEqual([
			{
				type: "text",
				text: [
					"Item collection",
					"Project items: 1",
					"Type-filtered items: 1",
					"Matched items: 1",
					"Page: 1",
					"Total pages: 1",
					"Page size: 25",
					"Returned items: 1",
					"Has previous page: false",
					"Has next page: false",
					"",
					"Items:",
					"- Water",
					"  ID: water",
					"  Type: simple",
					"  Description:",
					"    Water",
					"    Keeps the factory flowing.",
				].join("\n"),
			},
		]);
		expect(itemCollection.structuredContent).toEqual({
			hasNextPage: false,
			hasPreviousPage: false,
			itemIds: [
				"water",
			],
			matchedItems: 1,
			page: 1,
			pageSize: 25,
			projectItems: 1,
			returnedItems: 1,
			totalPages: 1,
			typeFilteredItems: 1,
		});
		const fuzzyItemCollection = await client.callTool({
			name: "item_collection",
			arguments: {
				query: "watr",
			},
		});
		expect(fuzzyItemCollection.content).toEqual(itemCollection.content);
		expect(
			(
				await client.callTool({
					name: "item_collection",
					arguments: {
						query: "completely unrelated",
					},
				})
			).content,
		).toEqual([
			{
				type: "text",
				text: [
					"Item collection",
					"Project items: 1",
					"Type-filtered items: 1",
					"Matched items: 0",
					"Page: 1",
					"Total pages: 0",
					"Page size: 25",
					"Returned items: 0",
					"Has previous page: false",
					"Has next page: false",
					"",
					"Items:",
					"- none",
				].join("\n"),
			},
		]);
		const itemDetail = await client.callTool({
			name: "item_detail",
			arguments: {
				id: "water",
			},
		});
		expect(itemDetail.content).toEqual([
			{
				type: "text",
				text: [
					"Item: Water",
					"ID: water",
					"UID: water",
					"Type: simple",
					"Description:",
					"  Water",
					"  Keeps the factory flowing.",
					"Storage: any",
					"Stack capacity: 10",
					"Game limit: 42",
				].join("\n"),
			},
		]);
		const missingItem = await client.callTool({
			name: "item_detail",
			arguments: {
				id: "missing",
			},
		});
		expect(missingItem).toMatchObject({
			isError: true,
			content: [
				{
					type: "text",
					text: "Editor operation failed: Item missing does not exist in the open project.",
				},
			],
		});

		const graphProjectId = "project-graph";
		const graphBase = createJobTestConfig();
		const forge = graphBase.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const graphConfig = GameConfigSchema.parse({
			...graphBase,
			start: {
				...graphBase.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			items: {
				...graphBase.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "ingot",
													quantity: {
														min: 1,
														max: 1,
													},
													placement: "drop",
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					})),
				},
				ingot: {
					...graphBase.items.tool,
					uid: "ingot",
					id: "ingot",
					title: "Ingot",
					description: "A forged ingot.",
				},
				unused: {
					...graphBase.items.tool,
					uid: "unused",
					id: "unused",
					title: "Unused",
					description: "Disconnected from the graph proof.",
				},
			},
		});
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: graphProjectId,
				config: graphConfig,
				resources: [],
			}),
		);
		ownership.setProjectContext(graphProjectId);
		const producerCollection = await client.callTool({
			name: "item_collection",
			arguments: {
				itemTypes: [
					"producer",
				],
			},
		});
		expect(producerCollection.content).toMatchObject([
			{
				text: expect.stringContaining(
					[
						"Item type filter (OR): producer",
						"Type-filtered items: 1",
						"Matched items: 1",
						"Page: 1",
						"Total pages: 1",
						"Page size: 25",
						"Returned items: 1",
						"Has previous page: false",
						"Has next page: false",
						"",
						"Items:",
						"- forge",
					].join("\n"),
				),
			},
		]);
		expect(producerCollection.structuredContent).toMatchObject({
			itemIds: [
				"forge",
			],
			itemTypes: [
				"producer",
			],
			matchedItems: 1,
			typeFilteredItems: 1,
		});
		const filteredQueryCollection = await client.callTool({
			name: "item_collection",
			arguments: {
				itemTypes: [
					"simple",
				],
				query: "producer",
			},
		});
		expect(filteredQueryCollection.structuredContent).toMatchObject({
			itemIds: [],
			matchedItems: 0,
			typeFilteredItems: 4,
		});
		const firstCollectionPage = await client.callTool({
			name: "item_collection",
			arguments: {
				pageSize: 2,
			},
		});
		expect(firstCollectionPage.content).toMatchObject([
			{
				text: expect.stringContaining(
					[
						"Project items: 5",
						"Type-filtered items: 5",
						"Matched items: 5",
						"Page: 1",
						"Total pages: 3",
						"Page size: 2",
						"Returned items: 2",
						"Has previous page: false",
						"Has next page: true",
						"Next page: 2",
					].join("\n"),
				),
			},
		]);
		expect(firstCollectionPage.structuredContent).toMatchObject({
			hasNextPage: true,
			hasPreviousPage: false,
			nextPage: 2,
			page: 1,
			pageSize: 2,
			projectItems: 5,
			returnedItems: 2,
			totalPages: 3,
			typeFilteredItems: 5,
		});
		const lastCollectionPage = await client.callTool({
			name: "item_collection",
			arguments: {
				page: 3,
				pageSize: 2,
			},
		});
		expect(lastCollectionPage.content).toMatchObject([
			{
				text: expect.stringContaining(
					[
						"Page: 3",
						"Total pages: 3",
						"Page size: 2",
						"Returned items: 1",
						"Has previous page: true",
						"Has next page: false",
						"Previous page: 2",
					].join("\n"),
				),
			},
		]);
		expect(lastCollectionPage.structuredContent).toMatchObject({
			hasNextPage: false,
			hasPreviousPage: true,
			page: 3,
			pageSize: 2,
			previousPage: 2,
			returnedItems: 1,
			totalPages: 3,
		});
		expect(
			(
				await client.callTool({
					name: "item_meta",
					arguments: {},
				})
			).content,
		).toEqual([
			{
				type: "text",
				text: "Total: 5\nproducer: 1\nsimple: 4",
			},
		]);
		const itemOutcome = await client.callTool({
			name: "item_outcome",
			arguments: {
				itemId: "water",
			},
		});
		expect(itemOutcome.content).toMatchObject([
			{
				text: expect.stringContaining("Item outcome for water [water; simple]"),
			},
		]);
		expect(itemOutcome.content).toMatchObject([
			{
				text: expect.stringContaining(
					[
						'- level 1: line "Run"',
						"  source item: forge [forge; producer]",
						"  line: line:forge:run",
						"  traversed:",
						"    - water [water; simple] -> forge [forge; producer]",
					].join("\n"),
				),
			},
		]);
		expect(itemOutcome.content).toMatchObject([
			{
				text: expect.not.stringContaining("source:forge:line:line:forge:run"),
			},
		]);
		expect(itemOutcome.content).toMatchObject([
			{
				text: expect.stringContaining(
					[
						"Reading guide:",
						"- level: relationship-hop distance from the requested item; level 1 is a direct relationship.",
						"- traversed: the matched external-input edge, printed as input item -> source item.",
						"- source item: the item that owns and runs the listed operation.",
						"- line / merge rule / relationship: the authored operation reference inside the source item.",
						"- external inputs: every item required by the operation except the source item itself.",
						"- outputs: every possible item emitted by the operation, not only the edge matched by this lookup.",
						"- output annotations: guaranteed/chance/weighted/replace describe selection; alternative set means mutually weighted sets; placement describes where the item appears.",
					].join("\n"),
				),
			},
		]);
		expect(itemOutcome.structuredContent).toEqual({
			direction: "outcome",
			itemId: "water",
			level: 1,
			operations: [
				{
					kind: "line",
					label: "Run",
					lineId: "line:forge:run",
					sourceItemId: "forge",
					type: "line",
				},
			],
			reachedItemIds: [
				"forge",
			],
			relationshipCount: 1,
		});
		const itemIncome = await client.callTool({
			name: "item_income",
			arguments: {
				itemId: "ingot",
			},
		});
		expect(itemIncome.content).toMatchObject([
			{
				text: expect.stringContaining("Item income for ingot [Ingot; simple]"),
			},
		]);
		expect(itemIncome.content).toMatchObject([
			{
				text: expect.stringContaining("forge [forge; producer] -> ingot [Ingot; simple]"),
			},
		]);
		expect(itemIncome.content).toMatchObject([
			{
				text: expect.stringContaining(
					"- traversed: the matched output edge, printed canonically as source item -> produced item.",
				),
			},
		]);
		expect(itemIncome.structuredContent).toEqual({
			direction: "income",
			itemId: "ingot",
			level: 1,
			operations: [
				{
					kind: "line",
					label: "Run",
					lineId: "line:forge:run",
					sourceItemId: "forge",
					type: "line",
				},
			],
			reachedItemIds: [
				"forge",
			],
			relationshipCount: 1,
		});
		const missingRelationItem = await client.callTool({
			name: "item_income",
			arguments: {
				itemId: "missing",
			},
		});
		expect(missingRelationItem).toMatchObject({
			isError: true,
			content: [
				{
					type: "text",
					text: "Editor operation failed: Item missing does not exist in the open project.",
				},
			],
		});
		ownership.setProjectContext(projectId);
		ownership.clearProjectContext("another-project");
		expect(ownership.readProjectContext()).toBe(projectId);
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
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/editor/mcp`)),
		);
		expect(legacyClient.getProtocolEra()).toBe("legacy");
		expect(legacyClient.getServerVersion()).toMatchObject({
			name: "arkini-editor",
			version: ArkiniAppVersion,
		});
		expect((await legacyClient.listTools()).tools.map(({ name }) => name)).toEqual([
			"project",
			"item_meta",
			"item_collection",
			"item_detail",
			"item_income",
			"item_outcome",
		]);
		expect(
			(
				await legacyClient.callTool({
					name: "project",
					arguments: {},
				})
			).content,
		).toMatchObject([
			{
				type: "text",
				text: expect.stringContaining(`Project ID: ${projectId}`),
			},
		]);
		ownership.clearProjectContext(projectId);
		expect(ownership.readProjectContext()).toBeUndefined();
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
