import { match, P } from "ts-pattern";
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
	return match(issue)
		.with(
			{
				code: "invalid_type",
				expected: "number",
			},
			() => textFn("Enter a valid number."),
		)
		.with(
			{
				code: "invalid_type",
			},
			() => textFn("Enter a valid value."),
		)
		.with(
			{
				code: "too_small",
				origin: "string",
				minimum: 1,
			},
			() => textFn("Enter a value."),
		)
		.with(
			{
				code: "too_small",
				origin: "number",
				minimum: P.nonNullable,
			},
			({ minimum }) =>
				textFn("Must be at least {minimum}.").replace("{minimum}", String(minimum)),
		)
		.with(
			{
				code: "too_small",
				origin: "array",
				minimum: 1,
			},
			() => textFn("Add at least one item."),
		)
		.with(
			{
				code: "too_small",
				origin: "array",
				minimum: P.nonNullable,
			},
			({ minimum }) =>
				textFn("Add at least {minimum} items.").replace("{minimum}", String(minimum)),
		)
		.with(
			{
				code: "too_big",
				origin: "number",
				maximum: P.nonNullable,
			},
			({ maximum }) =>
				textFn("Must be at most {maximum}.").replace("{maximum}", String(maximum)),
		)
		.with(
			{
				code: "too_big",
				origin: "array",
				maximum: 1,
			},
			() => textFn("Keep at most one item."),
		)
		.with(
			{
				code: "too_big",
				origin: "array",
				maximum: P.nonNullable,
			},
			({ maximum }) =>
				textFn("Keep at most {maximum} items.").replace("{maximum}", String(maximum)),
		)
		.with(
			{
				code: "invalid_value",
			},
			() => textFn("Choose a valid value."),
		)
		.otherwise(({ message }) => textFn(message));
};
