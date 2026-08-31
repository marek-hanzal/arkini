import { Effect } from "effect";
import type { z } from "zod";

import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Parses one untrusted editor IPC request into the canonical repository error contract. */
export const parseEditorProjectIpcRequestFx = <Value>(
	operation: ProjectRepositoryError["operation"],
	schema: z.ZodType<Value>,
	candidate: unknown,
): Effect.Effect<Value, ProjectRepositoryError, never> =>
	Effect.try({
		try: () => {
			const result = schema.safeParse(candidate);
			if (result.success) return result.data;
			throw new ProjectRepositoryError({
				operation,
				message: "The editor project request is invalid.",
				cause: result.error,
			});
		},
		catch: (error) => error as ProjectRepositoryError,
	});
