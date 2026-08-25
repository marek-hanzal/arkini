import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorNoteContentSchema } from "~/editor/note/EditorNoteSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createNoteSchema = z
	.object({
		projectId: IdSchema,
		content: EditorNoteContentSchema,
	})
	.strict();
const noteKeySchema = z
	.object({
		projectId: IdSchema,
		noteId: IdSchema,
	})
	.strict();
const updateNoteSchema = noteKeySchema
	.extend({
		content: EditorNoteContentSchema,
	})
	.strict();

/** Creates the validator capability for project-note IPC requests. */
export const createEditorNoteRequestParserFx = Effect.fn("createEditorNoteRequestParserFx")(() =>
	Effect.succeed({
		parseProjectIdFx: (candidate: unknown) =>
			parseEditorProjectIpcRequestFx("list-notes", IdSchema, candidate),
		parseCreateFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.CreateNoteProps, EditorProjectRepositoryError> =>
			parseEditorProjectIpcRequestFx("create-note", createNoteSchema, candidate),
		parseUpdateFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.UpdateNoteProps, EditorProjectRepositoryError> =>
			parseEditorProjectIpcRequestFx("update-note", updateNoteSchema, candidate),
		parseDeleteFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.NoteKey, EditorProjectRepositoryError> =>
			parseEditorProjectIpcRequestFx("delete-note", noteKeySchema, candidate),
	} as const),
);
