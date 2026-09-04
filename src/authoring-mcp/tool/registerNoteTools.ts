import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { NoteContentSchema, type NoteSchema } from "~/project-note/schema/NoteSchema";
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
		query: z
			.string()
			.optional()
			.describe("Optional case-insensitive search across complete note content."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:note-collection-input",
		title: "Note collection tool input",
		description: "Pagination and full-content search for the project note collection.",
	});

const NoteDetailInputSchema = z
	.object({
		noteId: IdSchema.describe("The exact note ID returned by note_collection."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:note-detail-input",
		title: "Note detail tool input",
		description: "The identity of the complete project note to read.",
	});

const CreateNoteInputSchema = z
	.object({
		content: NoteContentSchema.describe("The complete Markdown note content."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:create-note-input",
		title: "Create note tool input",
		description: "The complete content of a new project note.",
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
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:edit-note-input",
		title: "Edit note tool input",
		description: "A freshness-guarded complete project note replacement.",
	});

const DeleteNoteInputSchema = noteMutationSchema.meta({
	$id: "urn:arkini:schema:mcp:delete-note-input",
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

const readNoteCollectionTextFn = (
	notes: ReadonlyArray<NoteSchema.Type>,
	input: NoteCollectionInput,
) => {
	const query = input.query?.trim().toLowerCase();
	const matches =
		query === undefined || query.length === 0
			? notes
			: notes.filter((note) => note.content.toLowerCase().includes(query));
	const totalPages = Math.ceil(matches.length / input.limit);
	const pageNotes = matches.slice((input.page - 1) * input.limit, input.page * input.limit);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.limit < matches.length;
	return [
		"Note collection",
		`Project notes: ${notes.length}`,
		`Matched notes: ${matches.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Limit: ${input.limit}`,
		`Returned notes: ${pageNotes.length}`,
		`Has previous page: ${hasPreviousPage}`,
		`Has next page: ${hasNextPage}`,
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
		"Notes:",
		pageNotes.length === 0
			? "- none"
			: pageNotes
					.map((note) =>
						[
							`- ${note.noteId}`,
							`  Created: ${new Date(note.createdAtMs).toISOString()}`,
							`  Updated: ${new Date(note.updatedAtMs).toISOString()}`,
							`  Updated at ms: ${note.updatedAtMs}`,
							`  Characters: ${
								[
									...note.content,
								].length
							}`,
							`  Preview: ${JSON.stringify(readExcerptFn(note.content))}`,
						].join("\n"),
					)
					.join("\n\n"),
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
				"List project notes newest first with bounded previews, exact IDs and freshness timestamps. Search matches complete note content before pagination. Use note_detail to read one complete Markdown note. Notes are not included in Versions or Arkpacks.",
			inputSchema: NoteCollectionInputSchema,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => repository.listNotesFx(project.projectId)),
					Effect.map((notes) => readNoteCollectionTextFn(notes, input)),
				),
			),
	);
	server.registerTool(
		"note_detail",
		{
			description:
				"Read one complete project note as canonical JSON. Copy updatedAtMs into edit_note or delete_note so stale mutations are rejected.",
			inputSchema: NoteDetailInputSchema,
		},
		async ({ noteId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readNoteFx(repository, project.projectId, noteId)),
					Effect.map((note) => JSON.stringify(note, null, 2)),
				),
			),
	);
	server.registerTool(
		"create_note",
		{
			description:
				"Create and persist one Markdown note in the open project. Notes remain outside project Versions and Arkpacks.",
			inputSchema: CreateNoteInputSchema,
		},
		async ({ content }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.createNoteFx({
								projectId: project.projectId,
								content,
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
				"Replace one complete Markdown note only if it still has the exact updatedAtMs returned by note_detail or note_collection.",
			inputSchema: EditNoteInputSchema,
		},
		async ({ content, expectedUpdatedAtMs, noteId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.updateNoteFx({
								projectId: project.projectId,
								content,
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
