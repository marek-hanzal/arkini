import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

type ItemEstimateIndexMethod = "static";
type ItemEstimateIndexStatus = "complete" | "partial" | "unreachable";

/** Compact list projection of the same static authored-data estimate used by detail. */
export interface ItemEstimateIndexEntry {
	readonly demand: number;
	readonly itemId: string;
	readonly method: ItemEstimateIndexMethod;
	readonly runtimeMs?: number;
	readonly status: ItemEstimateIndexStatus;
}

export interface ItemEstimateIndexRow {
	readonly estimate: ItemEstimateIndexEntry;
	readonly item: ItemSchema.Type;
}
