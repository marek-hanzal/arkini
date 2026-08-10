import { Effect } from "effect";

import type { EditorGameDiagnostic } from "~/bridge/arkpack/editor/readEditorBuildDiagnosticsFx";
import { readEditorGameDiagnosticPresentationFx } from "~/bridge/arkpack/editor/readEditorGameDiagnosticPresentationFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorDiagnosticTarget } from "~/ui/arkpack/editor/EditorDiagnosticTarget";
import { readEditorGameDiagnosticTargetsFx } from "~/ui/arkpack/editor/readEditorGameDiagnosticTargetsFx";

export type { EditorDiagnosticTarget } from "~/ui/arkpack/editor/EditorDiagnosticTarget";

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
export const printEditorGameDiagnosticFx = Effect.fn("printEditorGameDiagnosticFx")(function* (
	diagnostic: EditorGameDiagnostic,
	project: Pick<EditorProject, "config" | "resources">,
) {
	const presentation = yield* readEditorGameDiagnosticPresentationFx(diagnostic);
	const targets = yield* readEditorGameDiagnosticTargetsFx(diagnostic, project);
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
	} satisfies EditorGameDiagnosticPresentation;
});
