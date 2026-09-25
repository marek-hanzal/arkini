import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** Keeps manual Default exclusive; expiry-only lines cannot be selected for production. */
export const setLineMarkerFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	index: number,
	value: boolean,
): LineSchema.Type[] =>
	lines.map((line, lineIndex) => ({
		...line,
		default:
			lineIndex === index
				? value && line.clock !== LineClockModeEnumSchema.enum["clock-lifetime"]
				: value
					? false
					: line.default,
	}));
