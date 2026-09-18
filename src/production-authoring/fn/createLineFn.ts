import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readEditorIdFromTitleFn } from "~/editor-control/fn/readEditorIdFromTitleFn";

/** Creates a fresh production line with an unused owner-local identity. */
export const createLineFn = (
	lines: ReadonlyArray<LineSchema.Type>,
	title: string,
	description: string,
): LineSchema.Type => {
	const baseId = readEditorIdFromTitleFn(title);
	const ids = new Set(lines.map((line) => line.id));
	let id = baseId;
	if (baseId !== "" && ids.has(id)) {
		let suffix = 2;
		while (ids.has(`${baseId}-${suffix}`)) suffix += 1;
		id = `${baseId}-${suffix}`;
	}
	return {
		id,
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
