export interface EditorItemOriginFlowLayoutProfile {
	readonly haloX: number;
	readonly haloY: number;
	readonly importance: number;
}

export interface EditorItemOriginFlowPair {
	readonly a: string;
	readonly b: string;
}

export interface EditorItemOriginFlowDirectedPair {
	readonly source: string;
	readonly target: string;
}

export interface EditorItemOriginFlowTopology {
	readonly directedPairs: ReadonlyArray<EditorItemOriginFlowDirectedPair>;
	readonly flowOrder: ReadonlyMap<string, number>;
	readonly pairs: ReadonlyArray<EditorItemOriginFlowPair>;
	readonly profiles: ReadonlyMap<string, EditorItemOriginFlowLayoutProfile>;
}
