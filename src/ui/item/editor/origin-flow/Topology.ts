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
