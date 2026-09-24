import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { NoteContentSchema, NoteSchema } from "~/project-note/schema/NoteSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

type ToolResult = {
	readonly isError?: boolean;
	readonly content: Array<{
		readonly type: "text";
		readonly text: string;
	}>;
};

type RunTool = (effect: Effect.Effect<string, unknown, never>) => Promise<ToolResult>;

const NoteCollectionInputSchema = z
	.object({
		page: z.number().int().min(1).default(1).describe("One-based page number."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(25)
			.describe("Maximum notes per page; defaults to 25 and is capped at 100."),
		itemUid: IdSchema.optional().describe("Only notes linked to this immutable item UID."),
		resourceUid: IdSchema.optional().describe(
			"Only notes linked to this resource ID; all supplied filters must match.",
		),
		query: z
			.string()
			.optional()
			.describe("Optional case-insensitive search across complete note content."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:note-collection-input",
		title: "Note collection tool input",
		description:
			"Item and resource filtering, pagination and full-content search for the project note collection.",
	});

const NoteDetailInputSchema = z
	.object({
		noteId: IdSchema.describe("The exact note ID returned by note_collection."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:note-detail-input",
		title: "Note detail tool input",
		description: "The identity of the complete project note to read.",
	});

const CreateNoteInputSchema = z
	.object({
		content: NoteContentSchema.describe("The complete Markdown note content."),
		itemUids: NoteSchema.shape.itemUids.describe(
			"Complete unique list of existing immutable item UIDs; use [] for no item links.",
		),
		resourceUids: NoteSchema.shape.resourceUids.describe(
			"Complete unique list of existing resource IDs; use [] for no resource links.",
		),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:create-note-input",
		title: "Create note tool input",
		description: "The complete content, item and resource relationships of a new project note.",
	});

const noteMutationSchema = z
	.object({
		noteId: IdSchema.describe("The exact note ID returned by note_collection."),
		expectedUpdatedAtMs: NonNegativeIntegerSchema.describe(
			"The exact updatedAtMs returned by note_detail or note_collection.",
		),
	})
	.strict();

const EditNoteInputSchema = noteMutationSchema
	.extend({
		content: NoteContentSchema.describe("The complete replacement Markdown content."),
		itemUids: NoteSchema.shape.itemUids.describe(
			"Complete replacement list of immutable item UIDs; omitting a previous UID unlinks it.",
		),
		resourceUids: NoteSchema.shape.resourceUids.describe(
			"Complete replacement list of resource IDs; omitting a previous ID unlinks it.",
		),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:edit-note-input",
		title: "Edit note tool input",
		description: "A freshness-guarded complete project note replacement.",
	});

const DeleteNoteInputSchema = noteMutationSchema.meta({
	$id: "urn:serakki:schema:mcp:delete-note-input",
	title: "Delete note tool input",
	description: "A freshness-guarded project note deletion.",
});

type NoteCollectionInput = z.output<typeof NoteCollectionInputSchema>;

const readExcerptFn = (content: string) => {
	const normalized = content.replaceAll(/\s+/g, " ").trim();
	const characters = [
		...normalized,
	];
	return characters.length <= 240 ? normalized : `${characters.slice(0, 240).join("")}…`;
};

const readNoteLinksFn = (note: NoteSchema.Type, project: Project) => [
	...note.itemUids.map((uid) => {
		const item = Object.hasOwn(project.config.items, uid)
			? project.config.items[uid]
			: undefined;
		return `Item: ${item?.title ?? "Missing item"} [${uid}]`;
	}),
	...note.resourceUids.map((uid) => {
		const resource = project.resources.find((candidate) => candidate.uid === uid);
		return resource === undefined
			? `Resource: Missing resource [${uid}]`
			: `Resource: ${resource.title ?? resource.type} [${uid}] (${resource.type})`;
	}),
];

const readNoteDetailTextFn = (note: NoteSchema.Type, project: Project) =>
	[
		`Note ID: ${note.noteId}`,
		`Project: ${project.config.meta.title} [${project.projectId}]`,
		`Revision: ${project.revision}`,
		`Created: ${new Date(note.createdAtMs).toISOString()}`,
		`Updated: ${new Date(note.updatedAtMs).toISOString()}`,
		`Updated at ms: ${note.updatedAtMs}`,
		...readNoteLinksFn(note, project),
		"",
		"Content:",
		note.content,
	].join("\n");

const readNoteCollectionTextFn = (
	notes: ReadonlyArray<NoteSchema.Type>,
	input: NoteCollectionInput,
	project: Project,
) => {
	const query = input.query?.trim().toLowerCase();
	const matches = notes.filter(
		(note) =>
			(input.itemUid === undefined || note.itemUids.includes(input.itemUid)) &&
			(input.resourceUid === undefined || note.resourceUids.includes(input.resourceUid)) &&
			(query === undefined ||
				query.length === 0 ||
				note.content.toLowerCase().includes(query)),
	);
	const totalPages = Math.ceil(matches.length / input.limit);
	const pageNotes = matches.slice((input.page - 1) * input.limit, input.page * input.limit);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.limit < matches.length;
	return [
		`Project: ${project.config.meta.title} [${project.projectId}]`,
		`Revision: ${project.revision}`,
		`Project notes: ${notes.length}`,
		`Matched notes: ${matches.length}`,
		`Page: ${input.page} of ${totalPages}; limit: ${input.limit}; returned: ${pageNotes.length}`,
		...(hasPreviousPage
			? [
					`Previous page: ${input.page - 1}`,
				]
			: []),
		...(hasNextPage
			? [
					`Next page: ${input.page + 1}`,
				]
			: []),
		"",
		...pageNotes.map((note) =>
			[
				`- ${readExcerptFn(note.content)}`,
				`  Note ID: ${note.noteId}`,
				`  Updated: ${new Date(note.updatedAtMs).toISOString()}; updatedAtMs: ${note.updatedAtMs}`,
				...readNoteLinksFn(note, project).map((link) => `  ${link}`),
			].join("\n"),
		),
	].join("\n");
};

const readNoteFx = Effect.fn("readMcpNoteFx")(function* (
	repository: ProjectRepositoryService,
	projectId: string,
	noteId: string,
) {
	const notes = yield* repository.listNotesFx(projectId);
	const note = notes.find((candidate) => candidate.noteId === noteId);
	if (note === undefined)
		return yield* Effect.fail(new Error(`Note ${noteId} does not exist in the open project.`));
	return note;
});

const describeNoteMutationFn = (action: "created" | "updated", note: NoteSchema.Type) =>
	[
		`Note ${action}`,
		`ID: ${note.noteId}`,
		`Created at ms: ${note.createdAtMs}`,
		`Updated at ms: ${note.updatedAtMs}`,
	].join("\n");

export namespace registerNoteToolsFn {
	export interface Props {
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly readProjectFx: () => Effect.Effect<Project, unknown, never>;
		readonly repository: ProjectRepositoryService;
		readonly runToolFn: RunTool;
		readonly server: McpServer;
	}
}

/** Registers project-scoped note discovery and freshness-guarded mutation tools. */
export const registerNoteToolsFn = ({
	notifyProjectChangedFn,
	readProjectFx,
	repository,
	runToolFn,
	server,
}: registerNoteToolsFn.Props) => {
	server.registerTool(
		"note_collection",
		{
			description:
				"List project notes newest first with bounded previews, exact IDs and freshness timestamps. Optional itemUid and resourceUid filters require matching item and resource links. Linked items include their immutable UIDs and human titles; linked resources include resource IDs and semantic types. All relationship filters and content search run before pagination. Use note_detail to read one complete Markdown note. Notes are not included in Serapacks.",
			inputSchema: NoteCollectionInputSchema,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.listNotesFx(project.projectId)
							.pipe(
								Effect.map((notes) =>
									readNoteCollectionTextFn(notes, input, project),
								),
							),
					),
				),
			),
	);
	server.registerTool(
		"note_detail",
		{
			description:
				"Read one complete Markdown note as formatted text with exact note ID, linked entity titles and IDs, creation/update times and the exact Updated at ms token. Copy that token into expectedUpdatedAtMs for edit_note or delete_note so stale mutations are rejected.",
			inputSchema: NoteDetailInputSchema,
		},
		async ({ noteId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readNoteFx(repository, project.projectId, noteId).pipe(
							Effect.map((note) => readNoteDetailTextFn(note, project)),
						),
					),
				),
			),
	);
	server.registerTool(
		"create_note",
		{
			description:
				"Create and persist one Markdown note in the open project. Notes remain outside Serapacks.",
			inputSchema: CreateNoteInputSchema,
		},
		async ({ content, itemUids, resourceUids }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.createNoteFx({
								projectId: project.projectId,
								content,
								itemUids,
								resourceUids,
							})
							.pipe(
								Effect.tap(() =>
									notifyProjectChangedFx(
										notifyProjectChangedFn,
										project.projectId,
									),
								),
							),
					),
					Effect.map((note) => describeNoteMutationFn("created", note)),
				),
			),
	);
	server.registerTool(
		"edit_note",
		{
			description:
				"Replace complete Markdown content, item and resource links only if it still has the exact updatedAtMs returned by note_detail or note_collection.",
			inputSchema: EditNoteInputSchema,
		},
		async ({ content, expectedUpdatedAtMs, itemUids, resourceUids, noteId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.updateNoteFx({
								projectId: project.projectId,
								content,
								itemUids,
								resourceUids,
								expectedUpdatedAtMs,
								noteId,
							})
							.pipe(
								Effect.tap(() =>
									notifyProjectChangedFx(
										notifyProjectChangedFn,
										project.projectId,
									),
								),
							),
					),
					Effect.map((note) => describeNoteMutationFn("updated", note)),
				),
			),
	);
	server.registerTool(
		"delete_note",
		{
			description:
				"Delete one project note only if it still has the exact updatedAtMs returned by note_detail or note_collection.",
			inputSchema: DeleteNoteInputSchema,
		},
		async ({ expectedUpdatedAtMs, noteId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.deleteNoteFx({
								projectId: project.projectId,
								expectedUpdatedAtMs,
								noteId,
							})
							.pipe(
								Effect.tap(() =>
									notifyProjectChangedFx(
										notifyProjectChangedFn,
										project.projectId,
									),
								),
								Effect.as(`Note deleted\nID: ${noteId}`),
							),
					),
				),
			),
	);
};
