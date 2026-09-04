import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";

type NoteRepository = Pick<
	ProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
>;

export namespace createNoteCommandAtomsFx {
	export type Command =
		| {
				readonly action: "load";
		  }
		| {
				readonly action: "create";
				readonly content: string;
		  }
		| {
				readonly action: "update";
				readonly content: string;
				readonly expectedUpdatedAtMs: number;
				readonly noteId: string;
		  }
		| {
				readonly action: "delete";
				readonly expectedUpdatedAtMs: number;
				readonly noteId: string;
		  };
}

/** Creates one mounted Atom-owned notes stream and command lifecycle per project. */
export const createNoteCommandAtomsFx = Effect.fn("createEditorNotesCommandAtomsFx")(
	(repository: NoteRepository) =>
		Effect.sync(() => {
			const streamFn = Atom.family((projectId: string) =>
				Atom.make<ReadonlyArray<NoteSchema.Type> | undefined>(undefined).pipe(
					Atom.withLabel(`EditorNotesStream:${projectId}`),
					Atom.setIdleTTL(0),
				),
			);
			// Background refresh has its own result so it cannot settle or erase a write.
			const refreshFn = Atom.family((projectId: string) =>
				Atom.fn(() =>
					repository
						.listNotesFx(projectId)
						.pipe(Effect.flatMap((notes) => Atom.set(streamFn(projectId), notes))),
				).pipe(Atom.withLabel(`EditorNotesRefresh:${projectId}`), Atom.setIdleTTL(0)),
			);
			const commandFn = Atom.family((projectId: string) => {
				const projectStream = streamFn(projectId);
				return Atom.fn(
					(
						input: Exclude<
							createNoteCommandAtomsFx.Command,
							{
								readonly action: "load";
							}
						>,
					) => {
						switch (input.action) {
							case "create":
								return repository
									.createNoteFx({
										projectId,
										content: input.content,
									})
									.pipe(
										Effect.flatMap((created) =>
											Atom.update(projectStream, (notes) => [
												created,
												...(notes ?? []),
											]),
										),
									);
							case "update":
								return repository
									.updateNoteFx({
										projectId,
										noteId: input.noteId,
										content: input.content,
										expectedUpdatedAtMs: input.expectedUpdatedAtMs,
									})
									.pipe(
										Effect.flatMap((updated) =>
											Atom.update(projectStream, (notes) => [
												updated,
												...(notes ?? []).filter(
													(note) => note.noteId !== updated.noteId,
												),
											]),
										),
									);
							case "delete":
								return repository
									.deleteNoteFx({
										projectId,
										noteId: input.noteId,
										expectedUpdatedAtMs: input.expectedUpdatedAtMs,
									})
									.pipe(
										Effect.andThen(
											Atom.update(projectStream, (notes) =>
												(notes ?? []).filter(
													(note) => note.noteId !== input.noteId,
												),
											),
										),
									);
						}
					},
				).pipe(Atom.withLabel(`EditorNotesCommand:${projectId}`), Atom.setIdleTTL(0));
			});
			return {
				commandFn,
				refreshFn,
				streamFn,
			};
		}),
);
