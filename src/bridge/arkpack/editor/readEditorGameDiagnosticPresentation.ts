import { readGameDiagnosticPresentation } from "~/engine/validation/printer/readGameDiagnosticPresentation";

import type { EditorGameDiagnostic } from "./readEditorBuildDiagnostics";

/** Exposes diagnostic copy to the editor without leaking engine modules into UI. */
export const readEditorGameDiagnosticPresentation = (diagnostic: EditorGameDiagnostic) =>
	readGameDiagnosticPresentation(diagnostic);
