import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorBoardScenarioNameSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";

import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const boardScenarioKeySchema = z
	.object({
		projectId: IdSchema,
		name: EditorBoardScenarioNameSchema,
	})
	.strict();
const writeBoardScenarioSchema = boardScenarioKeySchema
	.extend({
		expectedRevision: z.number().int().nonnegative(),
		bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0),
	})
	.strict();

/** Creates the validator capability for Board-scenario IPC requests. */
export const createEditorBoardScenarioRequestParserFx = Effect.fn(
	"createEditorBoardScenarioRequestParserFx",
)(() =>
	Effect.succeed({
		parseProjectIdFx: (candidate: unknown) =>
			parseEditorProjectIpcRequestFx("list-board-scenarios", IdSchema, candidate),
		parseReadKeyFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.BoardScenarioKey, EditorProjectRepositoryError> =>
			parseEditorProjectIpcRequestFx(
				"read-board-scenario",
				boardScenarioKeySchema,
				candidate,
			),
		parseDeleteKeyFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.BoardScenarioKey, EditorProjectRepositoryError> =>
			parseEditorProjectIpcRequestFx(
				"delete-board-scenario",
				boardScenarioKeySchema,
				candidate,
			),
		parseWriteFx: (
			candidate: unknown,
		): Effect.Effect<
			EditorProjectRepository.WriteBoardScenarioProps,
			EditorProjectRepositoryError
		> =>
			parseEditorProjectIpcRequestFx(
				"write-board-scenario",
				writeBoardScenarioSchema,
				candidate,
			),
	} as const),
);
