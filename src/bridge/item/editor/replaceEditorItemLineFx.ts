import { Effect } from "effect";

import type { EditorItem, EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export type EditorLineOwnerItem = Extract<
	EditorItem,
	{
		readonly type: "blueprint" | "craft" | "deposit" | "producer" | "stash";
	}
>;

export namespace replaceEditorItemLineFx {
	export interface Props {
		readonly item: EditorLineOwnerItem;
		readonly line: EditorLine;
		readonly projectId: string;
	}
}

/** Replaces one UID-owned line through the canonical atomic item-save boundary. */
export const replaceEditorItemLineFx = Effect.fn("replaceEditorItemLineFx")(function* ({
	item,
	line,
	projectId,
}: replaceEditorItemLineFx.Props) {
	if (item.type === "blueprint" || item.type === "craft" || item.type === "stash") {
		if (item.line.id !== line.id)
			return yield* new EditorProjectError({
				reason: "invalid-item",
				message: `Line ${line.id} does not belong to item ${item.id}.`,
			});
		return yield* saveEditorItemFx({
			item: {
				...item,
				line,
			},
			projectId,
		});
	}
	const lines = item.lines ?? [];
	if (!lines.some((candidate) => candidate.id === line.id))
		return yield* new EditorProjectError({
			reason: "invalid-item",
			message: `Line ${line.id} does not belong to item ${item.id}.`,
		});
	const nextLines = lines.map((candidate) => (candidate.id === line.id ? line : candidate)) as [
		EditorLine,
		...EditorLine[],
	];
	return yield* saveEditorItemFx({
		item: {
			...item,
			lines: nextLines,
		},
		projectId,
	});
});
