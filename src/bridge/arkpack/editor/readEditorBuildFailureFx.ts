import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";

export type EditorGameDiagnostic = GameDiagnosticSchema.Type;

export type EditorBuildFailure =
	| {
			readonly type: "validation";
			readonly diagnostics: ReadonlyArray<EditorGameDiagnostic>;
	  }
	| {
			readonly type: "operational";
			readonly detail: string;
	  };

/** Separates authored validation failures from safe operational Build failures. */
export const readEditorBuildFailureFx = Effect.fn("readEditorBuildFailureFx")((error: unknown) =>
	Effect.sync((): EditorBuildFailure | undefined => {
		if (error === undefined) return undefined;
		if (error instanceof GameValidationError)
			return {
				type: "validation",
				diagnostics: error.diagnostics,
			};
		if (error instanceof EditorProjectRepositoryError) {
			if (error.diagnostics !== undefined)
				return {
					type: "validation",
					diagnostics: error.diagnostics,
				};
			return {
				type: "operational",
				detail: error.message,
			};
		}
		return {
			type: "operational",
			detail: "The Editor project could not be built because of an unknown error.",
		};
	}),
);
