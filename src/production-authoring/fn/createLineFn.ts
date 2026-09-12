import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Creates a fresh production line with an unused owner-local identity. */
export const createLineFn = (
	ownerId: string,
	lines: ReadonlyArray<LineSchema.Type>,
	title: string,
	description: string,
): LineSchema.Type => {
	const prefix = `line:${ownerId.replace(/^item:/, "") || "new-item"}`;
	const ids = new Set(lines.map((line) => line.id));
	let id = `${prefix}:default`;
	if (lines.length > 0 || ids.has(id)) {
		let suffix = 2;
		while (ids.has(`${prefix}:${suffix}`)) suffix += 1;
		id = `${prefix}:${suffix}`;
	}
	return {
		id,
		title,
		description,
		default: lines.length === 0,
		show: true,
		enable: true,
		runtimeMs: 0,
		input: [
			{
				type: "simple",
			},
		],
		rules: [],
	};
};
