export type EditorItemEstimateIndexMethod = "static";
export type EditorItemEstimateIndexStatus = "complete" | "partial" | "unreachable";

/** Compact list projection of the same static authored-data estimate used by detail. */
export interface EditorItemEstimateIndexEntry {
	readonly itemId: string;
	readonly method: EditorItemEstimateIndexMethod;
	readonly runtimeMs?: number;
	readonly status: EditorItemEstimateIndexStatus;
}
