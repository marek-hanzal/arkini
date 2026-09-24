import { match } from "ts-pattern";
import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Keeps Default exclusive while allowing independent Clock participation. */
export const setLineMarkerFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	index: number,
	marker: "default" | "clock",
	value: boolean,
): LineSchema.Type[] =>
	lines.map((line, lineIndex) =>
		match({
			selected: lineIndex === index,
			marker,
			value,
			default: line.default,
		})
			.with(
				{
					selected: true,
				},
				() => ({
					...line,
					[marker]: value,
				}),
			)
			.with(
				{
					marker: "default",
					value: true,
					default: true,
				},
				() => ({
					...line,
					[marker]: false,
				}),
			)
			.otherwise(() => line),
	);
