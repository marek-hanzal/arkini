import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Selects at most one sibling for one marker without changing the other marker. */
export const setLineMarkerFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	index: number,
	marker: "default" | "clock",
	value: boolean,
): LineSchema.Type[] =>
	lines.map((line, lineIndex) =>
		lineIndex === index
			? {
					...line,
					[marker]: value,
				}
			: value && line[marker] === true
				? {
						...line,
						[marker]: false,
					}
				: line,
	);
