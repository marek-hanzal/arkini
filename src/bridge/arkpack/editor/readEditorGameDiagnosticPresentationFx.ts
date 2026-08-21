import { Effect } from "effect";

import { readGameDiagnosticPresentationFx } from "~/engine/validation/printer/readGameDiagnosticPresentationFx";

import type { EditorGameDiagnostic } from "./readEditorBuildDiagnosticsFx";

/** Exposes diagnostic copy to the editor without leaking engine modules into UI. */
export const readEditorGameDiagnosticPresentationFx = Effect.fn(
	"readEditorGameDiagnosticPresentationFx",
)((diagnostic: EditorGameDiagnostic) => readGameDiagnosticPresentationFx(diagnostic));
