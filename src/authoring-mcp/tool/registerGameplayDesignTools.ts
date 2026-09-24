import { EditorToolAnnotations } from "./EditorToolAnnotations";
import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
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
import { updateStartSpaceFx } from "./updateStartSpaceFx";

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
	$id: "urn:serakki:schema:mcp:project-json-input",
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
		itemUid: IdSchema.describe("The current exact item UID."),
		title: TitleSchema,
		revision: RevisionSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:rename-item-input",
		title: "Rename item tool input",
		description: "An item title change with immutable UID and revision guard.",
	});

const ItemDeleteImpactInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact item UID."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-delete-impact-input",
		title: "Item delete impact tool input",
		description: "The item whose deletion impact should be inspected.",
	});

const DeleteItemInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact item UID inspected by item_delete_impact."),
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

const SetStartSpaceInputSchema = z
	.object({
		revision: RevisionSchema,
		space: NonNegativeIntegerSchema,
		templateUid: IdSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:set-start-space-input",
		title: "Set initial space template",
		description:
			"Assign a reusable template to one initial space at an exact project revision.",
	});
const RemoveStartSpaceInputSchema = z
	.object({
		revision: RevisionSchema,
		space: NonNegativeIntegerSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:remove-start-space-input",
		title: "Remove initial space template",
		description: "Remove one initial space assignment at an exact project revision.",
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
				templates: project.config.templates,
			},
		},
		null,
		2,
	);

const formatListFn = (values: ReadonlyArray<string>) =>
	values.length === 0 ? "none" : values.join(", ");

const readItemDeleteImpactTextFx = Effect.fn("readItemDeleteImpactTextFx")(function* (
	project: Project,
	itemUid: string,
) {
	const { blockers, impact, item } = yield* readItemDeleteImpactFx(project, itemUid);
	const lines = [
		"Item delete impact",
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
		`- Lines removed: ${formatListFn(impact.removedLines.map(({ ownerItemUid, lineUid }) => `${ownerItemUid}/${lineUid}`))}`,
		`- Merge rules removed: ${formatListFn(impact.removedMergeRules.map(({ ownerItemUid, ruleNumber }) => `${ownerItemUid}#${ruleNumber}`))}`,
		...impact.removedTemplateEntries.map(
			(template) =>
				`- Template ${template.title} (${template.templateUid}): ${template.count} placements removed`,
		),
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
		"project_json",
		{
			annotations: EditorToolAnnotations.readOnly,
			description:
				"Read JSON containing the complete editable non-item project config and its revision. The config contains full meta, resources, templates, and start sections but intentionally excludes items. Prefer template_collection, template_detail or template_json to read a single template; read item_json for one complete item.",
			inputSchema: ProjectConfigInputSchema,
		},
		async () => runToolFn(readProjectFx().pipe(Effect.map(readProjectConfigTextFn))),
	);
	server.registerTool(
		"edit_project",
		{
			annotations: EditorToolAnnotations.replace,
			description: `Patch the open project's non-item config. Pass input as a serialized JSON object matching schema ${JSON.stringify(editProjectInputSchemaId)}; retrieve it and each returned $ref through schema_json. Supplied top-level sections replace their complete values and omitted sections remain unchanged; this is not a nested merge. Read project_json first, preserve every unchanged value inside a replaced section, and copy its revision when freshness matters. The stable meta.id cannot be changed. Prefer create_template, edit_template, edit_template_cells and delete_template for focused template edits.`,
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
			annotations: EditorToolAnnotations.guardedReplace,
			description:
				"Patch fallback dimensions used for new templates. Existing templates keep their own dimensions; use edit_template to resize one. Read project_json first and copy its revision.",
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
		"set_start_space",
		{
			annotations: EditorToolAnnotations.guardedReplace,
			description:
				"Assign an existing template to an initial space. Reusing a template creates independent runtime items. Use template_collection to find a template UID and project revision, or read project_json.",
			inputSchema: SetStartSpaceInputSchema,
		},
		async ({ templateUid, space, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						updateStartSpaceFx({
							change: {
								templateUid,
								type: "set",
							},
							space,
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
		"remove_start_space",
		{
			annotations: EditorToolAnnotations.guardedReplace,
			description:
				"Remove one initial space assignment without modifying the template. The unmapped space starts empty with project fallback dimensions. Read project_json first and copy its revision.",
			inputSchema: RemoveStartSpaceInputSchema,
		},
		async ({ space, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						updateStartSpaceFx({
							change: {
								type: "remove",
							},
							space,
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
			annotations: EditorToolAnnotations.readOnly,
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
			annotations: EditorToolAnnotations.replace,
			description:
				"Rename an item title while preserving its immutable UID. Uses a revision-guarded project write",
			inputSchema: RenameItemInputSchema,
		},
		async ({ itemUid, title, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						renameItemFx({
							itemUid,
							title,
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
			annotations: EditorToolAnnotations.readOnly,
			description:
				"Preview whether an item can be safely deleted and every canonical structure a force delete would remove. Read this immediately before delete_item and copy its revision into the destructive request.",
			inputSchema: ItemDeleteImpactInputSchema,
		},
		async ({ itemUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemDeleteImpactTextFx(project, itemUid)),
				),
			),
	);
	server.registerTool(
		"delete_item",
		{
			annotations: EditorToolAnnotations.guardedReplace,
			description:
				"Delete one item at the exact revision returned by item_delete_impact. Safe mode rejects referenced items. Force mode removes the item and the referencing structures listed by that impact in one project write; it never guesses through stale state.",
			inputSchema: DeleteItemInputSchema,
		},
		async ({ force, itemUid, revision }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						deleteItemFx({
							force,
							itemUid,
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
