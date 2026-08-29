import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import type { EditorNoteSchema } from "~/editor/note/EditorNoteSchema";

type NoteRepository = Pick<
	EditorProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
>;

export namespace createEditorNotesCommandAtomsFx {
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
				readonly noteId: string;
		  }
		| {
				readonly action: "delete";
				readonly noteId: string;
		  };
}

/** Creates one mounted Atom-owned notes stream and command lifecycle per project. */
export const createEditorNotesCommandAtomsFx = Effect.fn("createEditorNotesCommandAtomsFx")(
	(repository: NoteRepository) =>
		Effect.sync(() => {
			const stream = Atom.family((projectId: string) =>
				Atom.make<ReadonlyArray<EditorNoteSchema.Type> | undefined>(undefined).pipe(
					Atom.withLabel(`EditorNotesStream:${projectId}`),
					Atom.setIdleTTL(0),
				),
			);
			const command = Atom.family((projectId: string) => {
				const projectStream = stream(projectId);
				return Atom.fn((input: createEditorNotesCommandAtomsFx.Command) => {
					switch (input.action) {
						case "load":
							return repository
								.listNotesFx(projectId)
								.pipe(Effect.flatMap((notes) => Atom.set(projectStream, notes)));
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
				}).pipe(Atom.withLabel(`EditorNotesCommand:${projectId}`), Atom.setIdleTTL(0));
			});
			return {
				command,
				stream,
			};
		}),
);
