interface EditorFormSchemaIssue {
	readonly code: string;
	readonly expected?: string;
	readonly maximum?: number | bigint;
	readonly message: string;
	readonly minimum?: number | bigint;
	readonly origin?: string;
}

/** Rewrites generic schema diagnostics into concise correction instructions for Editor fields. */
export const readEditorFormValidationMessageFn = (issue: EditorFormSchemaIssue) => {
	if (issue.code === "invalid_type")
		return issue.expected === "number" ? "Enter a valid number." : "Enter a valid value.";
	if (issue.code === "too_small") {
		if (issue.origin === "string" && issue.minimum === 1) return "Enter a value.";
		if (issue.origin === "number" && issue.minimum !== undefined)
			return `Must be at least ${issue.minimum}.`;
		if (issue.origin === "array" && issue.minimum !== undefined)
			return `Add at least ${issue.minimum} item${issue.minimum === 1 ? "" : "s"}.`;
	}
	if (issue.code === "too_big") {
		if (issue.origin === "number" && issue.maximum !== undefined)
			return `Must be at most ${issue.maximum}.`;
		if (issue.origin === "array" && issue.maximum !== undefined)
			return `Keep at most ${issue.maximum} item${issue.maximum === 1 ? "" : "s"}.`;
	}
	if (issue.code === "invalid_value") return "Choose a valid value.";
	return issue.message;
};
