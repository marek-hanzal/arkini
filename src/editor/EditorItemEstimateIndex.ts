export type EditorItemEstimateIndexMethod = "engine-backed";
export type EditorItemEstimateIndexStatus = "estimated" | "inconclusive" | "no-finite-path";

/** Compact list projection of the same authoritative engine-backed item estimate used by detail. */
export interface EditorItemEstimateIndexEntry {
	readonly itemId: string;
	readonly method: EditorItemEstimateIndexMethod;
	readonly runtimeMs?: number;
	readonly status: EditorItemEstimateIndexStatus;
}

export interface EditorItemEstimateIndexProgress {
	readonly completed: number;
	readonly total: number;
}
