export interface LayoutProfile {
	readonly haloX: number;
	readonly haloY: number;
	readonly importance: number;
}

export interface Pair {
	readonly a: string;
	readonly b: string;
}

export interface DirectedPair {
	readonly source: string;
	readonly target: string;
}

export interface Topology {
	readonly directedPairs: ReadonlyArray<DirectedPair>;
	readonly flowOrder: ReadonlyMap<string, number>;
	readonly pairs: ReadonlyArray<Pair>;
	readonly profiles: ReadonlyMap<string, LayoutProfile>;
}
