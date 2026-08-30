import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

type EditorItemEstimateIndexMethod = "static";
type EditorItemEstimateIndexStatus = "complete" | "partial" | "unreachable";

/** Compact list projection of the same static authored-data estimate used by detail. */
export interface EditorItemEstimateIndexEntry {
	readonly demand: number;
	readonly itemId: string;
	readonly method: EditorItemEstimateIndexMethod;
	readonly runtimeMs?: number;
	readonly status: EditorItemEstimateIndexStatus;
}

export interface EditorItemEstimateIndexRow {
	readonly estimate: EditorItemEstimateIndexEntry;
	readonly item: ItemSchema.Type;
}
