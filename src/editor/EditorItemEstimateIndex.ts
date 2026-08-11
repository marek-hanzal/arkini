export interface EditorItemEstimateIndexEntry {
	readonly itemId: string;
	readonly runtimeMs?: number;
}

export interface EditorItemEstimateIndexProgress {
	readonly completed: number;
	readonly itemId: string;
	readonly total: number;
}
