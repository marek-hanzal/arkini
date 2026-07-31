import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";

/** Keeps every Fuse-backed editor item picker on the same searchable corpus. */
export const createEditorItemSearchTerms = (item: EditorItem, sourceId = item.id) => [
	sourceId,
	item.id,
	item.title,
	item.description,
	item.type,
	item.categoryId,
	...item.tags,
];
