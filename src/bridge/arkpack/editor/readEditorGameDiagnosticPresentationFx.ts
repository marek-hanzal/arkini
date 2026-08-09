import { Effect } from "effect";

import { readGameDiagnosticPresentation } from "~/engine/validation/printer/readGameDiagnosticPresentation";

import type { EditorGameDiagnostic } from "./readEditorBuildDiagnosticsFx";

/** Exposes diagnostic copy to the editor without leaking engine modules into UI. */
export const readEditorGameDiagnosticPresentationFx = Effect.fn(
	"readEditorGameDiagnosticPresentationFx",
)((diagnostic: EditorGameDiagnostic) =>
	Effect.sync(() => readGameDiagnosticPresentation(diagnostic)),
);
