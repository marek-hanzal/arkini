import type { EditorGameDiagnostic } from "~/editor/build/fn/readEditorBuildFailureFn";
import type { EditorProject } from "~/editor/EditorProject";
import { readGameDiagnosticPresentationFn } from "~/engine/validation/printer/fn/readGameDiagnosticPresentationFn";
import type { EditorDiagnosticTarget } from "~/ui/arkpack/editor/EditorDiagnosticTarget";
import { readEditorGameDiagnosticTargetsFn } from "~/ui/arkpack/editor/fn/readEditorGameDiagnosticTargetsFn";

export interface EditorGameDiagnosticPresentation {
	readonly code: EditorGameDiagnostic["code"];
	readonly severity: EditorGameDiagnostic["severity"];
	readonly title: string;
	readonly detail: string;
	readonly context?: string;
	readonly location?: string;
	readonly targets: ReadonlyArray<EditorDiagnosticTarget>;
}

/** Projects one canonical diagnostic into editor copy and actionable route targets. */
export const printEditorGameDiagnosticFn = (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
): EditorGameDiagnosticPresentation => {
	const presentation = readGameDiagnosticPresentationFn(diagnostic);
	const targets = readEditorGameDiagnosticTargetsFn(diagnostic, project);
	const location = [
		diagnostic.source,
		diagnostic.path.length === 0 ? undefined : diagnostic.path.join("."),
	]
		.filter((value) => value !== undefined)
		.join(":");

	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		...presentation,
		location: location.length === 0 ? undefined : location,
		targets,
	};
};
