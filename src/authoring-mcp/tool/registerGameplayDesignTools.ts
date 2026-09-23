import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { deleteItemFx } from "./deleteItemFx";
import { EditProjectInputSchema } from "./EditProjectInputSchema";
import { JsonToolInputSchema } from "./JsonToolInputSchema";
import { editProjectLayoutFx } from "./editProjectLayoutFx";
import { editProjectFx } from "./editProjectFx";
import { parseToolInputJsonFx } from "./parseToolInputJsonFx";
import { readItemDeleteImpactFx } from "./readItemDeleteImpactFx";
import { readProjectValidationTextFx } from "./readProjectValidationTextFx";
import { renameItemFx } from "./renameItemFx";
import { resolveSchemaId } from "./resolveSchemaId";
import { updateStartItemFx } from "./updateStartItemFx";

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
	$id: "urn:serakki:schema:mcp:project-config-input",
	title: "Project configuration tool input",
	description: "The project configuration read tool accepts no arguments.",
});

const ValidateProjectInputSchema = z
	.object({
		includeWarnings: z
			.boolean()
			.default(true)
			.describe("Whether warning diagnostics should be included in the result."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:validate-project-input",
		title: "Validate project tool input",
		description: "Controls whether project validation includes warning diagnostics.",
	});

const RenameItemInputSchema = z
	.object({
		itemId: IdSchema.describe("The current exact item ID."),
		id: IdSchema.optional().describe("The replacement unique item ID."),
		title: TitleSchema.optional(),
		artwork: z
			.boolean()
			.optional()
			.describe(
				"Also rename the sole default Artwork to the supplied id. Requires id; ambiguous compositions fail.",
			),
		revision: RevisionSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:rename-item-input",
		title: "Rename item tool input",
		description:
			"An item title and/or ID rename with optional Artwork synchronization and revision guard.",
	});

const ItemDeleteImpactInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-delete-impact-input",
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
		$id: "urn:serakki:schema:mcp:delete-item-input",
		title: "Delete item tool input",
		description: "A revision-guarded safe or forced item deletion request.",
	});

const EditProjectLayoutInputSchema = z
	.object({
		revision: RevisionSchema,
		board: SizeSchema.describe("The complete replacement board size."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:edit-project-layout-input",
		minProperties: 2,
		title: "Edit project layout tool input",
		description: "A revision-pinned patch of the board size.",
	});

const SetStartItemInputSchema = z
	.object({
		revision: RevisionSchema,
		location: BoardLocationSchema.describe(
			"The exact initial slot to set. Board locations require an explicit numeric space.",
		),
		itemId: IdSchema.describe("The exact canonical item ID to place initially."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:set-start-item-input",
		title: "Set start item tool input",
		description: "One exact initial item to insert or replace at a grid location.",
	});

const RemoveStartItemInputSchema = z
	.object({
		revision: RevisionSchema,
		location: BoardLocationSchema.describe(
			"The exact initial slot to clear. Board locations require an explicit numeric space.",
		),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:remove-start-item-input",
		title: "Remove start item tool input",
		description: "The exact occupied initial grid location to clear.",
	});

const readProjectConfigTextFn = (project: Project) =>
	JSON.stringify(
		{
			projectId: project.projectId,
			revision: project.revision,
			version: formatVersionFn(project.version),
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
	project: Project,
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
		`- Unit outcomes removed from: ${formatListFn(impact.removedUnitOutcomeOwnerIds)}`,
		`- Expiry outcomes removed from: ${formatListFn(impact.removedExpiryOutcomeOwnerIds)}`,
		`- Lines removed: ${formatListFn(impact.removedLines.map(({ ownerItemId, lineId }) => `${ownerItemId}/${lineId}`))}`,
		`- Merge rules removed: ${formatListFn(impact.removedMergeRules.map(({ ownerItemId, ruleNumber }) => `${ownerItemId}#${ruleNumber}`))}`,
		...impact.removedTemplateEntries.map(
			(template) =>
				`- Template ${template.title} (${template.templateUid}): ${template.count} placements removed`,
		),
		`- Start entries removed: board ${impact.removedStartEntries.board}`,
	);
	return lines.join("\n");
});

/** Registers the project lifecycle and destructive gameplay-design tools as one coherent surface. */
export const registerGameplayDesignToolsFn = ({
	notifyProjectChangedFn,
	readProjectFx,
	repository,
	runToolFn,
	server,
}: {
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly readProjectFx: () => Effect.Effect<Project, unknown, never>;
	readonly repository: ProjectRepositoryService;
	readonly runToolFn: (effect: Effect.Effect<string, unknown, never>) => Promise<ToolResult>;
	readonly server: McpServer;
}) => {
	const editProjectInputSchemaId = resolveSchemaId(EditProjectInputSchema);
	server.registerTool(
		"project_config",
		{
			description:
				"Read JSON containing the complete editable non-item project config and its revision. The config contains full meta, resources, and start sections but intentionally excludes items. Read item_config for one complete item.",
			inputSchema: ProjectConfigInputSchema,
		},
		async () => runToolFn(readProjectFx().pipe(Effect.map(readProjectConfigTextFn))),
	);
	server.registerTool(
		"edit_project",
		{
			description: `Patch the open project's non-item config. Pass input as a serialized JSON object matching schema ${JSON.stringify(editProjectInputSchemaId)}; retrieve it and each returned $ref through schema_detail. Supplied top-level sections replace their complete values and omitted sections remain unchanged; this is not a nested merge. Read project_config first, preserve every unchanged value inside a replaced section, and copy its revision when freshness matters. The stable meta.id cannot be changed.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				parseToolInputJsonFx(input, EditProjectInputSchema).pipe(
					Effect.flatMap((decodedInput) =>
						readProjectFx().pipe(
							Effect.flatMap((project) =>
								editProjectFx({
									input: decodedInput,
									notifyProjectChangedFn,
									project,
									repository,
								}),
							),
						),
					),
				),
			),
	);
	server.registerTool(
		"edit_project_layout",
		{
			description:
				"Patch one or more project layout capacities without replacing unrelated metadata. Shrinking rejects every authored start item that would fall outside the new board instead of deleting it. Read project_config first and copy its revision.",
			inputSchema: EditProjectLayoutInputSchema,
		},
		async ({ board, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						editProjectLayoutFx({
							board,
							notifyProjectChangedFn,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
	server.registerTool(
		"set_start_item",
		{
			description:
				"Insert or replace one exact initial item. A board location must include its numeric space. The item must exist, fit the layout. Read project_config first and copy its revision.",
			inputSchema: SetStartItemInputSchema,
		},
		async ({ itemId, location, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						updateStartItemFx({
							change: {
								itemId,
								type: "set",
							},
							location,
							notifyProjectChangedFn,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
	server.registerTool(
		"remove_start_item",
		{
			description:
				"Remove the item at one exact initial location. A board location must include its numeric space, so equal coordinates in another space remain untouched. Read project_config first and copy its revision.",
			inputSchema: RemoveStartItemInputSchema,
		},
		async ({ location, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						updateStartItemFx({
							change: {
								type: "remove",
							},
							location,
							notifyProjectChangedFn,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
	server.registerTool(
		"validate_project",
		{
			description:
				"Validate the canonical saved project with the same completed-game semantic and resource-reference rules used by the editor build path. Set includeWarnings to false to return only errors. Returns readable diagnostics; it does not re-decode stored PNG bytes.",
			inputSchema: ValidateProjectInputSchema,
		},
		async ({ includeWarnings }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readProjectValidationTextFx(project, includeWarnings),
					),
				),
			),
	);
	server.registerTool(
		"rename_item",
		{
			description:
				"Rename an item title and/or ID. Supply at least one of title or id. With artwork: true, id is required and the single artwork.default resource is renamed to that ID, including all resource and Note references. Missing or multiple default artworks and resource ID collisions fail before writing. The item UID is preserved. Uses one revision-guarded, locked best-effort project write; I/O failures have no aggregate rollback.",
			inputSchema: RenameItemInputSchema,
		},
		async ({ itemId, id, title, artwork, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						renameItemFx({
							itemId,
							id,
							title,
							artwork,
							notifyProjectChangedFn,
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
			runToolFn(
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
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						deleteItemFx({
							force,
							itemId,
							notifyProjectChangedFn,
							project,
							repository,
							revision,
						}),
					),
				),
			),
	);
};
