interface EditorFormSchemaIssue {
	readonly code: string;
	readonly expected?: string;
	readonly maximum?: number | bigint;
	readonly message: string;
	readonly minimum?: number | bigint;
	readonly origin?: string;
}

/** Rewrites generic schema diagnostics into translated, concise correction instructions. */
export const readEditorFormValidationMessageFn = (
	issue: EditorFormSchemaIssue,
	textFn: (key: string) => string,
) => {
	if (issue.code === "invalid_type")
		return issue.expected === "number"
			? textFn("Enter a valid number.")
			: textFn("Enter a valid value.");
	if (issue.code === "too_small") {
		if (issue.origin === "string" && issue.minimum === 1) return textFn("Enter a value.");
		if (issue.origin === "number" && issue.minimum !== undefined)
			return textFn("Must be at least {minimum}.").replace(
				"{minimum}",
				String(issue.minimum),
			);
		if (issue.origin === "array" && issue.minimum !== undefined)
			return issue.minimum === 1
				? textFn("Add at least one item.")
				: textFn("Add at least {minimum} items.").replace(
						"{minimum}",
						String(issue.minimum),
					);
	}
	if (issue.code === "too_big") {
		if (issue.origin === "number" && issue.maximum !== undefined)
			return textFn("Must be at most {maximum}.").replace("{maximum}", String(issue.maximum));
		if (issue.origin === "array" && issue.maximum !== undefined)
			return issue.maximum === 1
				? textFn("Keep at most one item.")
				: textFn("Keep at most {maximum} items.").replace(
						"{maximum}",
						String(issue.maximum),
					);
	}
	if (issue.code === "invalid_value") return textFn("Choose a valid value.");
	return textFn(issue.message);
};
