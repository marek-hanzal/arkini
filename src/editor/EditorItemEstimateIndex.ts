export interface EditorItemEstimateIndexEntry {
	readonly expectedRuntimeMs?: number;
	readonly guaranteedRuntimeMs?: number;
	readonly itemId: string;
}

export interface EditorItemEstimateIndexProgress {
	readonly completed: number;
	readonly itemId: string;
	readonly total: number;
}
