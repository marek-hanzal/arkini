export interface SurfaceLayout {
	readonly cellSize: number;
	readonly columns: number;
	readonly height: number;
	readonly kind: "board";
	readonly rows: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}
