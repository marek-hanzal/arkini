import { Effect } from "effect";
import type { z } from "zod";

import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";

/** Parses one untrusted editor IPC request into the canonical repository error contract. */
export const parseEditorProjectIpcRequestFx = <Value>(
	operation: EditorProjectRepositoryError["operation"],
	schema: z.ZodType<Value>,
	candidate: unknown,
): Effect.Effect<Value, EditorProjectRepositoryError> =>
	Effect.try({
		try: () => {
			const result = schema.safeParse(candidate);
			if (result.success) return result.data;
			throw new EditorProjectRepositoryError({
				operation,
				message: "The editor project request is invalid.",
				cause: result.error,
			});
		},
		catch: (error) => error as EditorProjectRepositoryError,
	});
