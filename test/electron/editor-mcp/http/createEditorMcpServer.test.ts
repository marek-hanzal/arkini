import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { createEditorMcpOwnershipFx } from "../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import {
	cleanupEditorMcpHarnesses,
	connectEditorMcpClient,
	createEditorMcpHarness,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("editor MCP server", () => {
	it("publishes the modern tool catalog and rejects calls without project context", async () => {
		const { ownership, port } = await createEditorMcpHarness();
		await Effect.runPromise(ownership.activateFx);
		const client = await connectEditorMcpClient(port);
		expect(client.getProtocolEra()).toBe("modern");
		expect(client.getServerVersion()).toMatchObject({
			name: "arkini-editor",
			version: ArkiniAppVersion,
		});
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toEqual([
			"create_simple_item",
			"create_producer_item",
			"create_craft_item",
			"create_blueprint_item",
			"create_deposit_item",
			"create_stash_item",
			"create_temporary_item",
			"create_inventory_item",
			"edit_simple_item",
			"edit_producer_item",
			"edit_craft_item",
			"edit_blueprint_item",
			"edit_deposit_item",
			"edit_stash_item",
			"edit_temporary_item",
			"edit_inventory_item",
			"project_config",
			"edit_project",
			"validate_project",
			"rename_item",
			"item_delete_impact",
			"delete_item",
			"project",
			"item_meta",
			"estimate",
			"item_collection",
			"item_detail",
			"item_config",
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
		expect(
			tools.tools.find(({ name }) => name === "estimate")?.inputSchema.properties,
		).toMatchObject({
			incomplete: {
				default: false,
				type: "boolean",
			},
			page: expect.any(Object),
			pageSize: expect.any(Object),
			query: expect.any(Object),
			sort: {
				default: "fastest",
				enum: [
					"fastest",
					"slowest",
					"demand",
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
		const runPromise: createEditorMcpOwnershipFx.Props["runPromise"] = (effect) => {
			runtimeCalls += 1;
			return Effect.runPromise(effect);
		};
		const { ownership, port, repository } = await createEditorMcpHarness(runPromise);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "project-context",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("project-context");
		ownership.clearProjectContext("another-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectEditorMcpClient(port);
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
		const { ownership, port, repository } = await createEditorMcpHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "legacy-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("legacy-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectEditorMcpClient(port, "legacy");
		expect(client.getProtocolEra()).toBe("legacy");
		expect((await client.listTools()).tools.map(({ name }) => name)).toEqual([
			"create_simple_item",
			"create_producer_item",
			"create_craft_item",
			"create_blueprint_item",
			"create_deposit_item",
			"create_stash_item",
			"create_temporary_item",
			"create_inventory_item",
			"edit_simple_item",
			"edit_producer_item",
			"edit_craft_item",
			"edit_blueprint_item",
			"edit_deposit_item",
			"edit_stash_item",
			"edit_temporary_item",
			"edit_inventory_item",
			"project_config",
			"edit_project",
			"validate_project",
			"rename_item",
			"item_delete_impact",
			"delete_item",
			"project",
			"item_meta",
			"estimate",
			"item_collection",
			"item_detail",
			"item_config",
			"item_input",
			"item_output",
			"item_estimate",
		]);
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
		const { ownership, port, repository } = await createEditorMcpHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "tool-project",
				version: "1.0",
				config: createJobTestConfig(),
				resources: [],
			}),
		);
		ownership.setProjectContext("tool-project");
		await Effect.runPromise(ownership.activateFx);
		const client = await connectEditorMcpClient(port);
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
				incomplete: true,
				pageSize: 2,
				sort: "demand",
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
		expect(globalEstimate.isError).not.toBe(true);
		expect(globalEstimate).not.toHaveProperty("structuredContent");
		expect(globalEstimate.content).toMatchObject([
			{
				text: expect.stringContaining(
					"Global estimate\nMethod: static authored dependency graph",
				),
			},
		]);
		expect(globalEstimate.content).toMatchObject([
			{
				text: expect.stringContaining("Incomplete only: true\nSort: demand"),
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
});
