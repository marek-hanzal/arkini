import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorLineSchema } from "~/bridge/item/editor/EditorLineSchema";

export interface InlineLineDraft {
	readonly description: string;
	readonly id: string;
	readonly runtimeSeconds: string;
	readonly title: string;
}

export type InlineLineDraftField = keyof Pick<
	InlineLineDraft,
	"description" | "runtimeSeconds" | "title"
>;

export type InlineLineDraftErrors = Partial<Record<InlineLineDraftField, string>>;

export const parseInlineLineDraft = (
	draft: InlineLineDraft,
	isDefault: boolean,
):
	| {
			readonly line: EditorLine;
			readonly errors?: never;
	  }
	| {
			readonly errors: InlineLineDraftErrors;
			readonly line?: never;
	  } => {
	const runtimeSeconds = Number(draft.runtimeSeconds);
	const errors: InlineLineDraftErrors = {};
	if (draft.title.trim() === "") errors.title = "Enter a line title.";
	if (draft.description.trim() === "") errors.description = "Describe what the line does.";
	if (
		draft.runtimeSeconds.trim() === "" ||
		!Number.isFinite(runtimeSeconds) ||
		runtimeSeconds < 0
	)
		errors.runtimeSeconds = "Enter a non-negative runtime.";
	if (Object.keys(errors).length > 0)
		return {
			errors,
		};
	const result = EditorLineSchema.safeParse({
		id: draft.id,
		title: draft.title,
		description: draft.description,
		default: isDefault,
		show: true,
		enable: true,
		runtimeMs: Math.round(runtimeSeconds * 1000),
		input: [
			{
				type: "simple",
			},
		],
		rules: [],
	});
	if (result.success)
		return {
			line: result.data,
		};
	for (const issue of result.error.issues) {
		const field = issue.path[0];
		if (field === "title" || field === "description") errors[field] ??= issue.message;
		if (field === "runtimeMs") errors.runtimeSeconds ??= issue.message;
	}
	return {
		errors,
	};
};
