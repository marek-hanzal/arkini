import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { deleteItemFx } from "./deleteItemFx";
import { EditProjectInputSchema } from "./EditProjectInputSchema";
import { editProjectFx } from "./editProjectFx";
import { readItemDeleteImpactFx } from "./readItemDeleteImpactFx";
import { readProjectValidationTextFx } from "./readProjectValidationTextFx";
import { renameItemFx } from "./renameItemFx";

interface ToolResult {
	[key: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}

const RevisionSchema = z.number().int().nonnegative().meta({
	id: "RevisionSchema",
	description: "The exact project revision returned by the preceding read tool.",
});

const ProjectConfigInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:project-config-input",
	title: "Project configuration tool input",
	description: "The project configuration read tool accepts no arguments.",
});

const ValidateProjectInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:validate-project-input",
	title: "Validate project tool input",
	description: "The project validation tool accepts no arguments.",
});

const RenameItemInputSchema = z
	.object({
		itemId: IdSchema.describe("The current exact item ID."),
		newItemId: IdSchema.describe("The new globally unique item ID."),
		revision: RevisionSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:rename-item-input",
		title: "Rename item tool input",
		description: "The current and replacement item IDs with an optional revision guard.",
	});

const ItemDeleteImpactInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-delete-impact-input",
		title: "Item delete impact tool input",
		description: "The item whose deletion impact should be inspected.",
	});

const DeleteItemInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID inspected by item_delete_impact."),
		revision: RevisionSchema,
		force: z
			.boolean()
			.default(false)
			.describe("False performs a safe delete; true applies the previewed cleanup."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:delete-item-input",
		title: "Delete item tool input",
		description: "A revision-guarded safe or forced item deletion request.",
	});

const readProjectConfigTextFn = (project: EditorProject) =>
	JSON.stringify(
		{
			projectId: project.projectId,
			revision: project.revision,
			version: project.version,
			config: {
				meta: project.config.meta,
				resources: project.config.resources,
				start: project.config.start,
			},
		},
		null,
		2,
	);

const formatListFn = (values: ReadonlyArray<string>) =>
	values.length === 0 ? "none" : values.join(", ");

const readItemDeleteImpactTextFx = Effect.fn("readItemDeleteImpactTextFx")(function* (
	project: EditorProject,
	itemId: string,
) {
	const { blockers, impact, item } = yield* readItemDeleteImpactFx(project, itemId);
	const lines = [
		"Item delete impact",
		`ID: ${itemId}`,
		`UID: ${item.uid}`,
		`Revision: ${project.revision}`,
		`References: ${blockers.length}`,
		`Safe delete: ${blockers.length === 0 ? "yes" : "no"}`,
	];
	if (blockers.length > 0) {
		lines.push("Reference paths:");
		for (const blocker of blockers)
			lines.push(`- ${blocker.path.join(".")}: ${blocker.message}`);
	}
	lines.push(
		"Force cleanup:",
		`- Owner items deleted: ${formatListFn(impact.deletedOwnerItemIds)}`,
		`- Charge outputs removed from: ${formatListFn(impact.removedChargeOutputOwnerIds)}`,
		`- Expiry outputs removed from: ${formatListFn(impact.removedExpiryOutputOwnerIds)}`,
		`- Lines removed: ${formatListFn(impact.removedLines.map(({ ownerItemId, lineId }) => `${ownerItemId}/${lineId}`))}`,
		`- Merge rules removed: ${formatListFn(impact.removedMergeRules.map(({ ownerItemId, ruleNumber }) => `${ownerItemId}#${ruleNumber}`))}`,
		`- Start entries removed: board ${impact.removedStartEntries.board}, inventory ${impact.removedStartEntries.inventory}, toolbar ${impact.removedStartEntries.toolbar}`,
	);
	return lines.join("\n");
});

/** Registers the project lifecycle and destructive gameplay-design tools as one coherent surface. */
export const registerGameplayDesignTools = ({
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
			inputSchema: ProjectConfigInputSchema,
		},
		async () => runTool(readProjectFx().pipe(Effect.map(readProjectConfigTextFn))),
	);
	server.registerTool(
		"edit_project",
		{
			description:
				"Patch the open project's non-item config. Supplied top-level sections replace their complete values and omitted sections remain unchanged; this is not a nested merge. Read project_config first, preserve every unchanged value inside a replaced section, and copy its revision when freshness matters. The stable meta.id cannot be changed.",
			inputSchema: EditProjectInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						editProjectFx({
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
			inputSchema: ValidateProjectInputSchema,
		},
		async () => runTool(readProjectFx().pipe(Effect.flatMap(readProjectValidationTextFx))),
	);
	server.registerTool(
		"rename_item",
		{
			description:
				"Rename one canonical item ID and every exact item reference in one revision-guarded project write. The item UID, line IDs, asset IDs, type, and all other fields remain unchanged. An optional revision copied from item_config rejects stale edits.",
			inputSchema: RenameItemInputSchema,
		},
		async ({ itemId, newItemId, revision }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						renameItemFx({
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
			inputSchema: ItemDeleteImpactInputSchema,
		},
		async ({ itemId }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemDeleteImpactTextFx(project, itemId)),
				),
			),
	);
	server.registerTool(
		"delete_item",
		{
			description:
				"Delete one item at the exact revision returned by item_delete_impact. Safe mode rejects referenced items. Force mode removes the item and the referencing structures listed by that impact in one project write; it never guesses through stale state.",
			inputSchema: DeleteItemInputSchema,
		},
		async ({ force, itemId, revision }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						deleteItemFx({
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
