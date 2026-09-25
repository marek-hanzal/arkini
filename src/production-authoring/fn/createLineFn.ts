import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Creates an Editor line draft with a caller-supplied immutable UID; input selection is required before saving. */
export const createLineFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	title: string,
	description: string,
	uid: string,
): LineSchema.Type => {
	return {
		uid,
		title,
		description,
		trigger: "manual",
		default: lines.length === 0,
		weight: 1,
		show: true,
		enable: true,
		runtimeMs: 30_000,
		input: [] as unknown as LineSchema.Type["input"],
		rules: [],
	};
};
