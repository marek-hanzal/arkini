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
		await Effect.runPromise(ownership.startLocalFx);
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
			"version_status",
			"version_list",
			"version_diff",
			"version_commit",
			"version_checkout",
			"version_tag",
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
		await Effect.runPromise(ownership.startLocalFx);
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
		await Effect.runPromise(ownership.startLocalFx);
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
			"version_status",
			"version_list",
			"version_diff",
			"version_commit",
			"version_checkout",
			"version_tag",
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
		await Effect.runPromise(ownership.startLocalFx);
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

	it("commits, inspects, tags, and renderer-checks out full project versions", async () => {
		const notifications: string[] = [];
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			(projectId) => notifications.push(projectId),
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "version-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const checkoutRequests: string[] = [];
		ownership.setProjectContext("version-project", (versionId) =>
			Effect.gen(function* () {
				checkoutRequests.push(versionId);
				const status = yield* repository.readVersionStatusFx("version-project");
				yield* repository.checkoutVersionFx({
					projectId: "version-project",
					versionId,
					expectedFingerprint: status.currentFingerprint,
				});
			}),
		);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);

		const initialStatus = await client.callTool({
			name: "version_status",
			arguments: {},
		});
		expect(initialStatus.content).toMatchObject([
			{
				text: expect.stringContaining("Versions: 0\nWorking copy: dirty"),
			},
		]);
		const committed = await client.callTool({
			name: "version_commit",
			arguments: {
				message: "Initial snapshot",
				tag: "baseline",
			},
		});
		expect(committed.isError).not.toBe(true);
		const [version] = await Effect.runPromise(repository.listVersionsFx("version-project"));
		if (version === undefined) throw new Error("Expected MCP-created version.");
		expect(committed.content).toMatchObject([
			{
				text: expect.stringContaining(version.versionId),
			},
		]);

		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: "version-project",
				expectedRevision: 0,
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						title: "Changed after snapshot",
					},
				},
			}),
		);
		const diff = await client.callTool({
			name: "version_diff",
			arguments: {
				from: version.versionId,
				to: "current",
			},
		});
		expect(diff.content).toMatchObject([
			{
				text: expect.stringContaining("config.meta.title"),
			},
		]);
		const tagged = await client.callTool({
			name: "version_tag",
			arguments: {
				versionId: version.versionId,
				tag: "restore-point",
			},
		});
		expect(tagged.content).toMatchObject([
			{
				text: expect.stringContaining("Tag: restore-point"),
			},
		]);
		const list = await client.callTool({
			name: "version_list",
			arguments: {},
		});
		expect(list.content).toMatchObject([
			{
				text: expect.stringContaining("Total: 1"),
			},
		]);
		const checkedOut = await client.callTool({
			name: "version_checkout",
			arguments: {
				versionId: version.versionId,
				confirmDiscardCurrentChanges: true,
			},
		});
		expect(checkedOut.content).toMatchObject([
			{
				text: expect.stringContaining("The mounted editor was refreshed in place."),
			},
		]);
		expect(checkoutRequests).toEqual([
			version.versionId,
		]);
		expect(
			(await Effect.runPromise(repository.readProjectFx("version-project")))?.config.meta
				.title,
		).toBe(editorTestPayload.config.meta.title);
		expect(notifications).toEqual([
			"version-project",
			"version-project",
		]);
	});
});
