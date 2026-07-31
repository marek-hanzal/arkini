import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

type EditorLineOwnerType = Extract<
	ItemEnumSchema.Type,
	"blueprint" | "craft" | "deposit" | "producer" | "stash"
>;

export namespace createEditorLineDraft {
	export interface Props {
		readonly existingLines: ReadonlyArray<LineSchema.Type>;
		readonly itemId: string;
		readonly type: EditorLineOwnerType;
	}
}

/** Creates one editor line with an owner-local unique ID and only the first line defaulted. */
export const createEditorLineDraft = ({
	existingLines,
	itemId,
	type,
}: createEditorLineDraft.Props): LineSchema.Type => {
	const ownerId = itemId.replace(/^(?:item|producer):/, "") || "new-item";
	const lineIdPrefix = `line:${ownerId}`;
	const existingIds = new Set(existingLines.map((line) => line.id));
	let id = `${lineIdPrefix}:default`;
	if (existingLines.length > 0 || existingIds.has(id)) {
		let suffix = 2;
		while (existingIds.has(`${lineIdPrefix}:${suffix}`)) suffix += 1;
		id = `${lineIdPrefix}:${suffix}`;
	}
	return {
		id,
		title: `New ${type} line`,
		description: `Describe what this ${type} line consumes and produces.`,
		default: existingLines.length === 0,
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
