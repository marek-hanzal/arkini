import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorBoardScenarioNameSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";

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

const parse = <Value>(
	operation: EditorProjectRepositoryError["operation"],
	schema: z.ZodType<Value>,
	candidate: unknown,
): Value => {
	const result = schema.safeParse(candidate);
	if (result.success) return result.data;
	throw new EditorProjectRepositoryError({
		operation,
		message: "The editor IPC request is invalid.",
		cause: result.error,
	});
};

/** Creates the validator capability for Board-scenario IPC requests. */
export const createEditorBoardScenarioRequestParserFx = Effect.fn(
	"createEditorBoardScenarioRequestParserFx",
)(() =>
	Effect.succeed({
		parseProjectIdFx: (candidate: unknown) =>
			Effect.try({
				try: () => parse("list-board-scenarios", IdSchema, candidate),
				catch: (error) => error as EditorProjectRepositoryError,
			}),
		parseReadKeyFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.BoardScenarioKey, EditorProjectRepositoryError> =>
			Effect.try({
				try: () => parse("read-board-scenario", boardScenarioKeySchema, candidate),
				catch: (error) => error as EditorProjectRepositoryError,
			}),
		parseDeleteKeyFx: (
			candidate: unknown,
		): Effect.Effect<EditorProjectRepository.BoardScenarioKey, EditorProjectRepositoryError> =>
			Effect.try({
				try: () => parse("delete-board-scenario", boardScenarioKeySchema, candidate),
				catch: (error) => error as EditorProjectRepositoryError,
			}),
		parseWriteFx: (
			candidate: unknown,
		): Effect.Effect<
			EditorProjectRepository.WriteBoardScenarioProps,
			EditorProjectRepositoryError
		> =>
			Effect.try({
				try: () => parse("write-board-scenario", writeBoardScenarioSchema, candidate),
				catch: (error) => error as EditorProjectRepositoryError,
			}),
	} as const),
);
