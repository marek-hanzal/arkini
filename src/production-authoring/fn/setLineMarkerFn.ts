import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Keeps Default exclusive while allowing independent Clock participation. */
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
			: marker === "default" && value && line.default === true
				? {
						...line,
						[marker]: false,
					}
				: line,
	);
