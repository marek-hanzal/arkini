import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";

/** Reads the first issue owned by one exact form-control path. */
export const readEditorFormValidationErrorFn = (
	issues: ReadonlyArray<EditorFormValidationIssue>,
	...path: ReadonlyArray<PropertyKey>
) =>
	issues.find(
		(issue) =>
			path.length <= issue.path.length &&
			path.every((segment, index) => issue.path[index] === segment),
	)?.message;
