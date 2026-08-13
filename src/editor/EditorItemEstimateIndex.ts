export type EditorItemEstimateIndexMethod = "engine-backed" | "structural-heuristic";
export type EditorItemEstimateIndexStatus = "estimated" | "inconclusive" | "no-finite-path";

/** Compact list projection. Detailed item estimates remain engine-backed and authoritative. */
export interface EditorItemEstimateIndexEntry {
	readonly itemId: string;
	readonly method: EditorItemEstimateIndexMethod;
	readonly runtimeMs?: number;
	readonly status: EditorItemEstimateIndexStatus;
}

export interface EditorItemEstimateIndexProgress {
	readonly completed: number;
	readonly itemId: string;
	readonly total: number;
}
