import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { deleteEditorMcpItemFx } from "./deleteEditorMcpItemFx";
import { EditorMcpEditProjectInputSchema } from "./EditorMcpProjectInputSchemas";
import { editEditorMcpProjectFx } from "./editEditorMcpProjectFx";
import { readEditorMcpItemDeleteImpactTextFx } from "./readEditorMcpItemDeleteImpactTextFx";
import { readEditorMcpProjectConfigTextFx } from "./readEditorMcpProjectConfigTextFx";
import { readEditorMcpProjectValidationTextFx } from "./readEditorMcpProjectValidationTextFx";
import { renameEditorMcpItemFx } from "./renameEditorMcpItemFx";

interface ToolResult {
	[key: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}

const RevisionSchema = z
	.number()
	.int()
	.nonnegative()
	.describe("The exact project revision returned by the preceding read tool.");

/** Registers the project lifecycle and destructive gameplay-design tools as one coherent surface. */
export const registerEditorMcpGameplayDesignTools = ({
	notifyProjectChanged,
	readProjectFx,
	repository,
	runTool,
	server,
}: {
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly readProjectFx: () => Effect.Effect<EditorProject, unknown>;
	readonly repository: EditorProjectRepositoryService;
	readonly runTool: (effect: Effect.Effect<string, unknown>) => Promise<ToolResult>;
	readonly server: McpServer;
}) => {
	server.registerTool(
		"project_config",
		{
			description:
				"Read JSON containing the complete editable non-item project config and its revision. The config contains full meta, resources, and start sections but intentionally excludes items. Read item_config for one complete item.",
		},
		async () => runTool(readProjectFx().pipe(Effect.flatMap(readEditorMcpProjectConfigTextFx))),
	);
	server.registerTool(
		"edit_project",
		{
			description:
				"Patch the open project's non-item config. Supplied top-level sections replace their complete values and omitted sections remain unchanged; this is not a nested merge. Read project_config first, preserve every unchanged value inside a replaced section, and copy its revision when freshness matters. The stable meta.id cannot be changed.",
			inputSchema: EditorMcpEditProjectInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						editEditorMcpProjectFx({
							input,
							notifyProjectChanged,
							project,
							repository,
						}),
					),
				),
			),
	);
	server.registerTool(
		"validate_project",
		{
			description:
				"Validate the canonical saved project with the same completed-game semantic and resource-reference rules used by the editor build path. Returns readable diagnostics; it does not re-decode stored PNG bytes.",
		},
		async () =>
			runTool(readProjectFx().pipe(Effect.flatMap(readEditorMcpProjectValidationTextFx))),
	);
	server.registerTool(
		"rename_item",
		{
			description:
				"Rename one canonical item ID and every exact item reference in one revision-guarded project write. The item UID, line IDs, asset IDs, type, and all other fields remain unchanged. An optional revision copied from item_config rejects stale edits.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe("The current exact item ID."),
					newItemId: IdSchema.describe("The new globally unique item ID."),
					revision: RevisionSchema.optional(),
				})
				.strict(),
		},
		async ({ itemId, newItemId, revision }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						renameEditorMcpItemFx({
							itemId,
							newItemId,
							notifyProjectChanged,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
	server.registerTool(
		"item_delete_impact",
		{
			description:
				"Preview whether an item can be safely deleted and every canonical structure a force delete would remove. Read this immediately before delete_item and copy its revision into the destructive request.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe("The exact item ID."),
				})
				.strict(),
		},
		async ({ itemId }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readEditorMcpItemDeleteImpactTextFx(project, itemId),
					),
				),
			),
	);
	server.registerTool(
		"delete_item",
		{
			description:
				"Delete one item at the exact revision returned by item_delete_impact. Safe mode rejects referenced items. Force mode removes the item and the referencing structures listed by that impact in one project write; it never guesses through stale state.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe("The exact item ID inspected by item_delete_impact."),
					revision: RevisionSchema,
					force: z
						.boolean()
						.default(false)
						.describe(
							"False performs a safe delete; true applies the previewed cleanup.",
						),
				})
				.strict(),
		},
		async ({ force, itemId, revision }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						deleteEditorMcpItemFx({
							force,
							itemId,
							notifyProjectChanged,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
};
