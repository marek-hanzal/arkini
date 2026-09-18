import type { LineSchema } from "~/production-line/schema/LineSchema";

const readDuplicateIdFn = (lines: ReadonlyArray<LineSchema.Type>, lineId: string): string => {
	if (lineId === "") return "";
	const ids = new Set(lines.map((line) => line.id));
	let suffix = 2;
	while (ids.has(`${lineId}-${suffix}`)) suffix += 1;
	return `${lineId}-${suffix}`;
};

/** Copies one complete line while clearing the owner-exclusive Default selection and assigning a fresh ID. */
export const duplicateLineFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	line: LineSchema.Type,
): LineSchema.Type => ({
	...structuredClone(line),
	id: readDuplicateIdFn(lines, line.id),
	default: false,
});
