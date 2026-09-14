import type { EditorFormValidationIssue } from "~/editor-control/type/EditorFormValidationIssue";

/** Maps a schema's missing collection index back to its visible collection selector. */
export const readRequiredEditorCollectionErrorFn = (
	issues: ReadonlyArray<EditorFormValidationIssue>,
	count: number,
	minimum: number,
	message: string,
	...path: ReadonlyArray<PropertyKey>
) => {
	if (count >= minimum) return undefined;
	return issues.some(
		(issue) =>
			path.every((segment, index) => issue.path[index] === segment) &&
			typeof issue.path[path.length] === "number",
	)
		? message
		: undefined;
};
