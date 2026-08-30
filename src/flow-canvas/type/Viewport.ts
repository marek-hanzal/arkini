export interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

export interface Bounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}
