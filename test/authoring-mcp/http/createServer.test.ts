import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { createEditorMcpOwnershipFx } from "~/authoring-mcp/http/createEditorMcpOwnershipFx";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
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
			name: "serakki-editor",
			version: SerakkiAppVersion,
		});
		const tools = await client.listTools();
		expect(tools.tools.map(({ name }) => name)).toEqual([
			"schema_json",
			"create_item",
			"edit_item",
			"create_item_line",
			"replace_item_line",
			"delete_item_line",
			"edit_item_lines",
			"item_line_order",
			"project_json",
			"edit_project",
			"edit_project_layout",
			"set_start_space",
			"remove_start_space",
			"validate_project",
			"rename_item",
			"item_delete_impact",
			"delete_item",
			"template_collection",
			"template_detail",
			"template_json",
			"create_template",
			"edit_template",
			"edit_template_cells",
			"delete_template",
			"project",
			"item_meta",
			"item_collection",
			"artwork_collection",
			"note_collection",
			"note_detail",
			"create_note",
			"edit_note",
			"delete_note",
			"item_detail",
			"item_json",
			"items_json",
			"item_lines",
			"item_lines_json",
			"item_line_json",
			"graph_schema_json",
			"graph_query",
			"graph_query_batch",
			"graph_operations_json",
			"item_input",
			"item_outcome",
			"item_chain",
		]);
		const artworkCollectionSchema = tools.tools.find(
			({ name }) => name === "artwork_collection",
		)?.inputSchema;
		expect(artworkCollectionSchema?.properties).toMatchObject({
			filter: {
				$ref: "#/$defs/ArtworkCollectionFilterSchema",
			},
			page: expect.any(Object),
			limit: expect.any(Object),
			query: expect.any(Object),
		});
		const artworkCollectionDefinitions = isJsonSchemaRecord(artworkCollectionSchema?.$defs)
			? artworkCollectionSchema.$defs
			: {};
		expect(artworkCollectionDefinitions.ArtworkCollectionFilterSchema).toMatchObject({
			enum: [
				"all",
				"unused",
			],
			type: "string",
		});
		const jsonInputToolNames = new Set([
			"create_template",
			"edit_template",
			"edit_template_cells",
			"create_item",
			"edit_item",
			"create_item_line",
			"replace_item_line",
			"delete_item_line",
			"edit_item_lines",
			"edit_project",
		]);
		for (const tool of tools.tools.filter(({ name }) => jsonInputToolNames.has(name))) {
			expectNamedJsonSchemaGraph(tool.inputSchema, {
				id: "urn:serakki:schema:mcp:json-tool-input",
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
				`"urn:serakki:schema:mcp:${tool.name.replaceAll("_", "-")}-input"`,
			);
		}
		tools.tools
			.filter(({ name }) => !jsonInputToolNames.has(name))
			.forEach(({ inputSchema, name }) => {
				const expectedId =
					name === "template_detail" || name === "template_json"
						? "urn:serakki:schema:mcp:template-read-input"
						: name === "item_input" || name === "item_outcome"
							? `urn:serakki:schema:mcp:${name.replaceAll("_", "-")}-relation`
							: `urn:serakki:schema:mcp:${name.replaceAll("_", "-")}-input`;
				expectNamedJsonSchemaGraph(inputSchema, {
					id: expectedId,
				});
			});
		expect(
			tools.tools.find(({ name }) => name === "validate_project")?.inputSchema.properties,
		).toMatchObject({
			includeWarnings: {
				default: true,
				type: "boolean",
			},
		});
		for (const toolName of [
			"item_input",
			"item_outcome",
		]) {
			const properties = tools.tools.find(({ name }) => name === toolName)?.inputSchema
				.properties;
			expect(properties).toHaveProperty("itemUid");
			expect(properties).toHaveProperty("level");
		}
		const missing = await client.callTool({
			name: "project",
			arguments: {},
		});
		expect(missing).toMatchObject({
			isError: true,
			content: [
				{
					text: "Editor operation failed: No editor project is currently open. Open a project in Serakki before using editor tools.",
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
						...editorTestPayload.resources.find(({ type }) => type === "artwork")!,
						uid: "cow",
					},
					{
						...editorTestPayload.resources.find(({ type }) => type === "artwork")!,
						uid: "cow-farm",
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
		const artwork = await client.callTool({
			name: "artwork_collection",
			arguments: {
				query: "cow",
			},
		});
		const rejectedLegacyPagination = await client.callTool({
			name: "artwork_collection",
			arguments: {
				pageSize: 1,
			},
		});
		expect(project.content).toMatchObject([
			{
				text: expect.stringContaining("Project ID: project-context"),
			},
		]);
		expect(artwork.content).toMatchObject([
			{
				text: expect.stringMatching(
					/- Type: artwork\n  UID: cow\n  Title: cow\n\n- Type: artwork\n  UID: cow-farm\n  Title: cow-farm/,
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
});
