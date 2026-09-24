import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { readTemplateDeleteBlockersFn } from "~/template-authoring/fn/readTemplateDeleteBlockersFn";
import { CreateTemplateInputSchema } from "./CreateTemplateInputSchema";
import { EditTemplateInputSchema } from "./EditTemplateInputSchema";
import { EditTemplateCellsInputSchema } from "./EditTemplateCellsInputSchema";
import { JsonToolInputSchema } from "./JsonToolInputSchema";
import { parseToolInputJsonFx } from "./parseToolInputJsonFx";
import { mutateTemplateFx } from "./mutateTemplateFx";
import { resolveSchemaId } from "./resolveSchemaId";

const TemplateCollectionInputSchema = z
	.object({
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(100).default(25),
		query: z
			.string()
			.optional()
			.describe("Optional fuzzy search across template UID and title."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:template-collection-input",
		title: "Template collection input",
		description: "Pagination and UID/title search for board templates.",
	});
const TemplateReadInputSchema = z
	.object({
		templateUid: IdSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:template-read-input",
		title: "Template read input",
		description: "The immutable template UID returned by template_collection.",
	});
const DeleteTemplateInputSchema = z
	.object({
		templateUid: IdSchema,
		revision: NonNegativeIntegerSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:delete-template-input",
		title: "Delete template input",
		description: "The immutable UID and current project revision for guarded deletion.",
	});

const readTemplateFx = Effect.fn("readMcpTemplateFx")(function* (
	project: Project,
	templateUid: string,
) {
	const template = project.config.templates?.find((entry) => entry.uid === templateUid);
	if (template === undefined)
		return yield* Effect.fail(
			new Error(
				`Template ${templateUid} does not exist. Read template_collection for available UIDs.`,
			),
		);
	return template;
});

const readCollectionTextFn = (
	project: Project,
	input: z.infer<typeof TemplateCollectionInputSchema>,
) => {
	const templates = project.config.templates ?? [];
	const matches = createFuzzySearchFn({
		candidates: templates.map((template) => ({
			terms: [
				template.uid,
				template.title,
			],
			value: template,
		})),
	})(input.query ?? "");
	const entries = matches.slice((input.page - 1) * input.limit, input.page * input.limit);
	return [
		`Project: ${project.config.meta.title} [${project.projectId}]`,
		`Revision: ${project.revision}`,
		`Templates: ${templates.length}; matched: ${matches.length}; page: ${input.page}; returned: ${entries.length}`,
		...entries.map(
			(template) =>
				`- ${template.title} [${template.uid}] | ${template.width} × ${template.height} | items: ${template.board.length}`,
		),
		...(input.page * input.limit < matches.length
			? [
					`Next page: ${input.page + 1}`,
				]
			: []),
	].join("\n");
};

const readDetailTextFx = Effect.fn("readTemplateDetailTextFx")(function* (
	project: Project,
	templateUid: string,
) {
	const template = yield* readTemplateFx(project, templateUid);
	const blockers = readTemplateDeleteBlockersFn(project.config, templateUid);
	return [
		`Template: ${template.title} [${template.uid}]`,
		`Project: ${project.config.meta.title} [${project.projectId}]`,
		`Revision: ${project.revision}`,
		`Board: ${template.width} × ${template.height}; items: ${template.board.length}`,
		...(template.board.length === 0
			? []
			: [
					"Placements (zero-based x, y):",
				]),
		...template.board.map((cell) => {
			const item = Object.hasOwn(project.config.items, cell.itemUid)
				? project.config.items[cell.itemUid]
				: undefined;
			return `- ${cell.x}, ${cell.y} → ${item?.title ?? "Missing item"} [${cell.itemUid}]`;
		}),
		`Deletion blockers: ${blockers.length}`,
		...blockers.map((entry) => `- ${entry.path.join(".")}: ${entry.message}`),
	].join("\n");
});

/** One discoverable template surface; reads share a snapshot and writes use the Editor repository. */
export const registerTemplateToolsFn = ({
	server,
	readProjectFx,
	repository,
	notifyProjectChangedFn,
	runToolFn,
}: {
	readonly server: McpServer;
	readonly readProjectFx: () => Effect.Effect<Project, unknown>;
	readonly repository: ProjectRepositoryService;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly runToolFn: (effect: Effect.Effect<string, unknown>) => Promise<{
		content: Array<{
			type: "text";
			text: string;
		}>;
		isError?: boolean;
	}>;
}) => {
	const runMutationFx = (change: mutateTemplateFx.Change) =>
		readProjectFx().pipe(
			Effect.flatMap((project) =>
				mutateTemplateFx({
					change,
					project,
					repository,
					notifyProjectChangedFn,
				}),
			),
		);
	server.registerTool(
		"template_collection",
		{
			description:
				"List board template UIDs, titles, dimensions and placement counts as compact text with the project revision. Page defaults to 1, limit to 25 (max 100); optional query searches UID/title. Use template_detail for cells/references or template_json for canonical JSON.",
			inputSchema: TemplateCollectionInputSchema,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(Effect.map((project) => readCollectionTextFn(project, input))),
			),
	);
	server.registerTool(
		"template_detail",
		{
			description:
				"Read one template as text: immutable UID, title, dimensions, every zero-based item placement, project revision and deletion blockers from initial spaces and Template outcomes. Use edit_template_cells for local edits; copy revision into mutations.",
			inputSchema: TemplateReadInputSchema,
		},
		async ({ templateUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readDetailTextFx(project, templateUid)),
				),
			),
	);
	server.registerTool(
		"template_json",
		{
			description:
				"Read JSON {revision, template} containing the complete canonical TemplateSchema configuration: uid, title, width, height and board [{itemUid,x,y}]. Use before replacing board through edit_template; preserve unchanged cells and copy revision. Prefer edit_template_cells for local changes.",
			inputSchema: TemplateReadInputSchema,
		},
		async ({ templateUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readTemplateFx(project, templateUid).pipe(
							Effect.map((template) =>
								JSON.stringify(
									{
										revision: project.revision,
										template,
									},
									null,
									2,
								),
							),
						),
					),
				),
			),
	);
	server.registerTool(
		"create_template",
		{
			description: `Create one template with a generated immutable UID. Requires revision from template_collection or project; omitted dimensions use project fallback dimensions and omitted board is empty. Returns UID and new revision as text. Pass input as serialized JSON matching schema ${JSON.stringify(resolveSchemaId(CreateTemplateInputSchema))}; retrieve it through schema_json. Assign the result using set_start_space or a Template outcome.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				parseToolInputJsonFx(input, CreateTemplateInputSchema).pipe(
					Effect.flatMap((decoded) =>
						runMutationFx({
							type: "create",
							input: decoded,
						}),
					),
				),
			),
	);
	server.registerTool(
		"edit_template",
		{
			description: `Patch one template's title, width, height or complete board. Omitted fields, UID, sibling templates and start assignments stay unchanged. Shrinking rejects stranded cells. Read template_json before replacing board; copy revision. Pass input as serialized JSON matching schema ${JSON.stringify(resolveSchemaId(EditTemplateInputSchema))}; retrieve it through schema_json. Returns text and new revision.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				parseToolInputJsonFx(input, EditTemplateInputSchema).pipe(
					Effect.flatMap((decoded) =>
						runMutationFx({
							type: "edit",
							input: decoded,
						}),
					),
				),
			),
	);
	server.registerTool(
		"edit_template_cells",
		{
			description: `Apply 1–100 ordered place, replace, move or remove changes to one template using its project revision. Coordinates are zero-based. Place requires an empty cell, replace/remove an occupied cell, move an occupied source and empty destination. Unknown items or out-of-bounds positions reject the entire batch before any write. Other templates and start assignments stay unchanged. Pass input as serialized JSON matching schema ${JSON.stringify(resolveSchemaId(EditTemplateCellsInputSchema))}; retrieve it through schema_json. Returns text and new revision.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				parseToolInputJsonFx(input, EditTemplateCellsInputSchema).pipe(
					Effect.flatMap((decoded) =>
						runMutationFx({
							type: "cells",
							input: decoded,
						}),
					),
				),
			),
	);
	server.registerTool(
		"delete_template",
		{
			description:
				"Delete exactly one unreferenced template at the revision from template_detail. Initial-space assignments and Template outcomes block deletion; errors list exact reference paths. Remove/reassign references explicitly first. No cascade or reassignment. Returns text and new revision.",
			inputSchema: DeleteTemplateInputSchema,
		},
		async (input) =>
			runToolFn(
				runMutationFx({
					type: "delete",
					input,
				}),
			),
	);
};
