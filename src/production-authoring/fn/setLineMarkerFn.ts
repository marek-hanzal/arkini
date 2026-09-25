import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Keeps manual Default exclusive; triggered lines cannot be selected for manual production. */
export const setLineMarkerFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	index: number,
	value: boolean,
): LineSchema.Type[] =>
	lines.map((line, lineIndex) => ({
		...line,
		default:
			lineIndex === index
				? value && line.trigger === LineTriggerEnumSchema.enum.manual
				: value
					? false
					: line.default,
	}));
