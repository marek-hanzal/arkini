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
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
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
			"create_simple_item",
			"create_space_item",
			"create_producer_item",
			"create_craft_item",
			"create_blueprint_item",
			"create_deposit_item",
			"create_stash_item",
			"create_temporary_item",
			"create_inventory_item",
			"edit_simple_item",
			"edit_space_item",
			"edit_producer_item",
			"edit_craft_item",
			"edit_blueprint_item",
			"edit_deposit_item",
			"edit_stash_item",
			"edit_temporary_item",
			"edit_inventory_item",
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
			"version_status",
			"version_commit_preview",
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
				$ref: "#/$defs/ItemTypeSchema",
			},
			type: "array",
		});
		const collectionSchema = tools.tools.find(
			({ name }) => name === "item_collection",
		)?.inputSchema;
		const collectionDefinitions = isJsonSchemaRecord(collectionSchema?.$defs)
			? collectionSchema.$defs
			: {};
		expect(collectionDefinitions.ItemTypeSchema).toMatchObject({
			enum: TypeSchema.options,
			type: "string",
		});
		const assetCollectionSchema = tools.tools.find(
			({ name }) => name === "asset_collection",
		)?.inputSchema;
		expect(assetCollectionSchema?.properties).toMatchObject({
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
		const jsonInputToolNames = new Set([
			...[
				"simple",
				"space",
				"producer",
				"craft",
				"blueprint",
				"deposit",
				"stash",
				"temporary",
				"inventory",
			].flatMap((type) => [
				`create_${type}_item`,
				`edit_${type}_item`,
			]),
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
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "project-context",
					},
				},
				resources: editorTestPayload.resources,
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
				query: "item-water",
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
				text: expect.stringContaining("- Type: image\n  ID: item-water"),
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
				version: "1.0",
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

	it("commits, inspects, tags, and renderer-checks out full project versions", async () => {
		const notifications: string[] = [];
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			(projectId) => notifications.push(projectId),
		);
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "version-project",
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		const checkoutRequests: string[] = [];
		ownership.setProjectContextFn("version-project", (versionId) =>
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
		const client = await connectMcpClient(port);

		const initialStatus = await client.callTool({
			name: "version_status",
			arguments: {},
		});
		expect(initialStatus.content).toMatchObject([
			{
				text: expect.stringContaining("Versions: 0\nWorking copy: dirty"),
			},
		]);
		const initialPreview = await client.callTool({
			name: "version_commit_preview",
			arguments: {},
		});
		expect(initialPreview.content).toMatchObject([
			{
				text: expect.stringContaining("Resulting Arkpack: v1.0\nCompatibility bump: noop"),
			},
		]);
		const initialPreviewText = initialPreview.content.find(({ type }) => type === "text");
		if (initialPreviewText?.type !== "text") throw new Error("Expected text preview.");
		const initialFingerprint = /Commit fingerprint: ([a-f0-9]{64})/.exec(
			initialPreviewText.text,
		)?.[1];
		if (initialFingerprint === undefined) throw new Error("Expected commit fingerprint.");
		const committed = await client.callTool({
			name: "version_commit",
			arguments: {
				message: "Initial snapshot",
				previewFingerprint: initialFingerprint,
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
				expectedRevision: created.revision,
				config: {
					...created.config,
					meta: {
						...created.config.meta,
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
				text: expect.stringContaining("config.meta.title · minor bump"),
			},
		]);
		const minorProject = await Effect.runPromise(repository.readProjectFx("version-project"));
		if (minorProject === null) throw new Error("Expected current project.");
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				bytes: Uint8Array.of(1, 2, 3),
				expectedRevision: minorProject.revision,
				name: "Opening",
				projectId: "version-project",
			}),
		);
		const minorPreview = await client.callTool({
			name: "version_commit_preview",
			arguments: {},
		});
		const minorPreviewText = minorPreview.content.find(({ type }) => type === "text");
		if (minorPreviewText?.type !== "text") throw new Error("Expected text preview.");
		expect(minorPreviewText.text).toContain(
			"Compatibility bump: minor\nBoard scenarios deleted by commit: 0",
		);
		const minorFingerprint = /Commit fingerprint: ([a-f0-9]{64})/.exec(
			minorPreviewText.text,
		)?.[1];
		if (minorFingerprint === undefined) throw new Error("Expected commit fingerprint.");
		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: "version-project",
				expectedRevision: minorProject.revision,
				config: {
					...minorProject.config,
					meta: {
						...minorProject.config.meta,
						board: {
							...minorProject.config.meta.board,
							width: minorProject.config.meta.board.width + 1,
						},
					},
				},
			}),
		);
		const staleCommit = await client.callTool({
			name: "version_commit",
			arguments: {
				message: "Stale preview must fail",
				previewFingerprint: minorFingerprint,
			},
		});
		expect(staleCommit.isError).toBe(true);
		expect(staleCommit.content).toMatchObject([
			{
				text: expect.stringContaining("changed after version_commit_preview"),
			},
		]);
		expect(
			await Effect.runPromise(repository.listBoardScenariosFx("version-project")),
		).toHaveLength(1);
		expect(await Effect.runPromise(repository.listVersionsFx("version-project"))).toHaveLength(
			1,
		);
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
				text: expect.stringContaining("The selected project's saved state was replaced."),
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
