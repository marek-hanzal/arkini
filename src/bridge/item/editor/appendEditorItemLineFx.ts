import { Effect } from "effect";

import type { EditorItem, EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";

export type EditorLineCollectionItem = Extract<
	EditorItem,
	{
		readonly type: "deposit" | "producer";
	}
>;

export namespace appendEditorItemLineFx {
	export interface Props {
		readonly item: EditorLineCollectionItem;
		readonly line: EditorLine;
		readonly projectId: string;
	}
}

/** Appends one validated line through the canonical atomic item-save boundary. */
export const appendEditorItemLineFx = Effect.fn("appendEditorItemLineFx")(function* ({
	item,
	line,
	projectId,
}: appendEditorItemLineFx.Props) {
	const lines = [
		...(item.lines ?? []),
		line,
	] as [
		EditorLine,
		...EditorLine[],
	];
	return yield* saveEditorItemFx({
		item: {
			...item,
			lines,
		},
		projectId,
	});
});
