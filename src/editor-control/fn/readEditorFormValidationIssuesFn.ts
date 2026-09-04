import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";

/** Projects issues below one collection or object path into that value's local coordinates. */
export const readEditorFormValidationIssuesFn = (
	issues: ReadonlyArray<EditorFormValidationIssue>,
	prefix: ReadonlyArray<PropertyKey>,
): ReadonlyArray<EditorFormValidationIssue> =>
	issues.flatMap((issue) =>
		prefix.every((segment, index) => issue.path[index] === segment)
			? [
					{
						message: issue.message,
						path: issue.path.slice(prefix.length),
					},
				]
			: [],
	);
