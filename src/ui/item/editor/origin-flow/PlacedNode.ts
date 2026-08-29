/** Mutable-placement result consumed by deterministic position normalization. */
export interface PlacedNode {
	readonly haloX: number;
	readonly haloY: number;
	readonly height: number;
	readonly id: string;
	readonly importance: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}
