import { Effect } from "effect";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import type { Project } from "~/project-authoring/type/Project";

export const editorNotesTestProject: Project = {
	projectId: "project-one",
	title: "Notes test",
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 1,
	resources: [],
	config: {
		...editorTestConfig,
		items: {
			wood: {
				...editorTestConfig.items.water,
				uid: "wood",
				id: "wood",
				title: "Timber",
			},
			"renamed-water": {
				...editorTestConfig.items.water,
				id: "renamed-water",
			},
		},
	},
};

import { createNoteCommandAtomsFx } from "~/project-note/fx/createNoteCommandAtomsFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";

export const editorNotesTestState = {
	beforeCreateFn: undefined as (() => Promise<void>) | undefined,
	createFailures: 0,
	listFailures: 0,
	nextNote: 2,
	notes: [
		{
			noteId: "note-one",
			projectId: "project-one",
			content: "Existing note",
			itemUids: [] as string[],
			createdAtMs: 1,
			updatedAtMs: 1,
		},
	],
};

const repository: Pick<
	ProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
> = {
	listNotesFx: () =>
		Effect.suspend(() => {
			if (editorNotesTestState.listFailures === 0)
				return Effect.succeed(editorNotesTestState.notes);
			editorNotesTestState.listFailures -= 1;
			return Effect.fail(
				new ProjectRepositoryError({
					operation: "list-notes",
					message: "Notes could not be loaded.",
				}),
			);
		}),
	createNoteFx: ({ projectId, content, itemUids }) =>
		Effect.promise(() => editorNotesTestState.beforeCreateFn?.() ?? Promise.resolve()).pipe(
			Effect.andThen(
				Effect.try({
					try: () => {
						if (editorNotesTestState.createFailures > 0) {
							editorNotesTestState.createFailures -= 1;
							throw new Error("Note could not be saved.");
						}
						const note = {
							noteId: `note-${editorNotesTestState.nextNote++}`,
							projectId,
							content,
							itemUids: [
								...itemUids,
							],
							createdAtMs: editorNotesTestState.nextNote,
							updatedAtMs: editorNotesTestState.nextNote,
						};
						editorNotesTestState.notes = [
							note,
							...editorNotesTestState.notes,
						];
						return note;
					},
					catch: (cause) =>
						new ProjectRepositoryError({
							operation: "create-note",
							message: cause instanceof Error ? cause.message : String(cause),
							cause,
						}),
				}),
			),
		),
	updateNoteFx: ({ projectId, noteId, content, itemUids, expectedUpdatedAtMs }) =>
		Effect.try({
			try: () => {
				const previous = editorNotesTestState.notes.find((note) => note.noteId === noteId);
				if (previous === undefined)
					throw new Error(`Editor note ${noteId} does not exist.`);
				if (previous.updatedAtMs !== expectedUpdatedAtMs)
					throw new Error(`Editor note ${noteId} changed after it was read.`);
				const updated = {
					...previous,
					projectId,
					content,
					itemUids: [
						...itemUids,
					],
					updatedAtMs: Math.max(
						editorNotesTestState.nextNote++,
						...editorNotesTestState.notes.map((note) => note.updatedAtMs + 1),
					),
				};
				editorNotesTestState.notes = [
					updated,
					...editorNotesTestState.notes.filter((note) => note.noteId !== noteId),
				];
				return updated;
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "update-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	deleteNoteFx: ({ noteId, expectedUpdatedAtMs }) =>
		Effect.try({
			try: () => {
				const previous = editorNotesTestState.notes.find((note) => note.noteId === noteId);
				if (previous === undefined)
					throw new Error(`Editor note ${noteId} does not exist.`);
				if (previous.updatedAtMs !== expectedUpdatedAtMs)
					throw new Error(`Editor note ${noteId} changed after it was read.`);
				editorNotesTestState.notes = editorNotesTestState.notes.filter(
					(note) => note.noteId !== noteId,
				);
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "delete-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
};

export const EditorNotesTestCommandAtoms = Effect.runSync(createNoteCommandAtomsFx(repository));
