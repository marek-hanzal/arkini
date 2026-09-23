import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Creates a fresh production line with an caller-supplied immutable UID. */
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
		default: lines.length === 0,
		clockWeight: 1,
		show: true,
		enable: true,
		runtimeMs: 30_000,
		input: [
			{
				type: "simple",
			},
		],
		rules: [],
	};
};
