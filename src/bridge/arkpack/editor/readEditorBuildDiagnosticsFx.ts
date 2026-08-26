import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";

export type EditorGameDiagnostic = GameDiagnosticSchema.Type;

/** Projects structured Build diagnostics without leaking engine errors into reusable UI. */
export const readEditorBuildDiagnosticsFx = Effect.fn("readEditorBuildDiagnosticsFx")(
	(error: unknown) =>
		Effect.sync(() =>
			error instanceof GameValidationError
				? error.diagnostics
				: error instanceof EditorProjectRepositoryError
					? error.diagnostics
					: undefined,
		),
);
