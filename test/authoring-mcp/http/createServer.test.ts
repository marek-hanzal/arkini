import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { createEditorMcpOwnershipFx } from "~/authoring-mcp/http/createEditorMcpOwnershipFx";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	expectNamedJsonSchemaGraph,
	isJsonSchemaRecord,
} from "~test/support/expectNamedJsonSchemaGraph";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP server", () => {
	it("publishes the modern tool catalog and rejects calls without project context", async () => {
		const { ownership, port } = await createMcpHarness();
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		expect(client.getProtocolEra()).toBe("modern");
		expect(client.getServerVersion()).toMatchObject({
			name: "arkini-editor",
			version: ArkiniAppVersion,
		});
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toEqual([
			"schema_detail",
			"create_item",
			"edit_item",
			"project_config",
			"edit_project",
			"edit_project_layout",
			"set_start_item",
			"remove_start_item",
			"validate_project",
			"rename_item",
			"item_delete_impact",
			"delete_item",
			"project",
			"item_meta",
			"estimate",
			"item_collection",
			"asset_collection",
			"note_collection",
			"note_detail",
			"create_note",
			"edit_note",
			"delete_note",
			"item_detail",
			"item_config",
			"item_input",
			"item_output",
			"item_estimate",
		]);
		const assetCollectionSchema = tools.tools.find(
			({ name }) => name === "asset_collection",
		)?.inputSchema;
		expect(assetCollectionSchema?.properties).toMatchObject({
			filter: {
				$ref: "#/$defs/AssetCollectionFilterSchema",
			},
			page: expect.any(Object),
			limit: expect.any(Object),
			query: expect.any(Object),
			type: {
				$ref: "#/$defs/AssetTypeSchema",
			},
		});
		const assetCollectionDefinitions = isJsonSchemaRecord(assetCollectionSchema?.$defs)
			? assetCollectionSchema.$defs
			: {};
		expect(assetCollectionDefinitions.AssetTypeSchema).toMatchObject({
			enum: [
				"image",
			],
			type: "string",
		});
		expect(assetCollectionDefinitions.AssetCollectionFilterSchema).toMatchObject({
			enum: [
				"all",
				"unused",
			],
			type: "string",
		});
		const jsonInputToolNames = new Set([
			"create_item",
			"edit_item",
			"edit_project",
		]);
		for (const tool of tools.tools.filter(({ name }) => jsonInputToolNames.has(name))) {
			expectNamedJsonSchemaGraph(tool.inputSchema, {
				id: "urn:arkini:schema:mcp:json-tool-input",
			});
			expect(tool.inputSchema).toMatchObject({
				additionalProperties: false,
				properties: {
					input: {
						minLength: 1,
						type: "string",
					},
				},
				required: [
					"input",
				],
			});
			expect(tool.description).toContain(
				`"urn:arkini:schema:mcp:${tool.name.replaceAll("_", "-")}-input"`,
			);
		}
		const schemaIds = tools.tools
			.filter(({ name }) => !jsonInputToolNames.has(name))
			.map(({ inputSchema, name }) => {
				const expectedId =
					name === "item_input" || name === "item_output"
						? `urn:arkini:schema:mcp:${name.replaceAll("_", "-")}-relation`
						: `urn:arkini:schema:mcp:${name.replaceAll("_", "-")}-input`;
				expectNamedJsonSchemaGraph(inputSchema, {
					id: expectedId,
				});
				return inputSchema.$id;
			});
		expect(new Set(schemaIds).size).toBe(schemaIds.length);
		expect(
			tools.tools.find(({ name }) => name === "estimate")?.inputSchema.properties,
		).toMatchObject({
			page: expect.any(Object),
			limit: expect.any(Object),
			query: expect.any(Object),
			view: {
				default: "fastest",
				enum: [
					"fastest",
					"slowest",
					"demand",
					"incomplete",
				],
			},
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
		const runPromiseFn: createEditorMcpOwnershipFx.Props["runPromiseFn"] = (effect) => {
			runtimeCalls += 1;
			return Effect.runPromise(effect);
		};
		const { ownership, port, repository } = await createMcpHarness(runPromiseFn);
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "project-context",
					},
				},
				resources: [
					...editorTestPayload.resources,
					{
						...editorTestPayload.resources[0],
						id: "cow",
					},
					{
						...editorTestPayload.resources[0],
						id: "cow-farm",
					},
				],
			}),
		);
		ownership.setProjectContextFn("project-context");
		ownership.clearProjectContextFn("another-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const project = await client.callTool({
			name: "project",
			arguments: {},
		});
		const assets = await client.callTool({
			name: "asset_collection",
			arguments: {
				query: "cow",
				type: "image",
			},
		});
		const rejectedLegacyPagination = await client.callTool({
			name: "asset_collection",
			arguments: {
				pageSize: 1,
				type: "image",
			},
		});
		expect(project.content).toMatchObject([
			{
				text: expect.stringContaining("Project ID: project-context"),
			},
		]);
		expect(assets.content).toMatchObject([
			{
				text: expect.stringMatching(
					/- Type: image\n  ID: cow\n\n- Type: image\n  ID: cow-farm/,
				),
			},
		]);
		expect(rejectedLegacyPagination).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining('Unrecognized key: "pageSize"'),
				},
			],
		});
		expect(runtimeCalls).toBe(2);
		ownership.clearProjectContextFn("project-context");
		expect(ownership.readProjectContextFn()).toBeUndefined();
	});

	it("routes relation and estimate requests through the active project", async () => {
		const { ownership, port, repository } = await createMcpHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...createJobTestConfig(),
					meta: {
						...createJobTestConfig().meta,
						id: "tool-project",
					},
				},
				resources: [],
			}),
		);
		ownership.setProjectContextFn("tool-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const relation = await client.callTool({
			name: "item_input",
			arguments: {
				itemId: "water",
				level: 2,
			},
		});
		const globalEstimate = await client.callTool({
			name: "estimate",
			arguments: {
				limit: 2,
				view: "incomplete",
			},
		});
		const estimate = await client.callTool({
			name: "item_estimate",
			arguments: {
				itemId: "tool",
			},
		});
		const missingEstimate = await client.callTool({
			name: "item_estimate",
			arguments: {
				itemId: "missing",
			},
		});

		expect(relation.isError).not.toBe(true);
		expect(relation).not.toHaveProperty("structuredContent");
		expect(relation.content).toMatchObject([
			{
				text: expect.stringContaining("Item input\nItem ID: water"),
			},
		]);
		expect(globalEstimate.isError).not.toBe(true);
		expect(globalEstimate).not.toHaveProperty("structuredContent");
		expect(globalEstimate.content).toMatchObject([
			{
				text: expect.stringContaining("View: incomplete"),
			},
		]);
		expect(estimate.isError).not.toBe(true);
		expect(estimate).not.toHaveProperty("structuredContent");
		expect(estimate.content).toMatchObject([
			{
				text: expect.stringContaining("Item estimate\nItem ID: tool"),
			},
		]);
		expect(missingEstimate).toMatchObject({
			isError: true,
			content: [
				{
					text: "Editor operation failed: Item missing does not exist in the open project.",
					type: "text",
				},
			],
		});
	});
});
