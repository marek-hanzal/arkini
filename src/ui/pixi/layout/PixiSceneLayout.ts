export interface PixiGridSurfaceLayout {
	readonly cellSize: number;
	readonly columns: number;
	readonly height: number;
	readonly kind: "board" | "inventory" | "toolbar";
	readonly rows: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface PixiMainSceneLayout {
	readonly board: PixiGridSurfaceLayout;
	readonly toolbar: PixiGridSurfaceLayout | null;
	readonly toolbarGap: number;
	readonly viewportPadding: number;
}

export interface PixiInventorySceneLayout {
	/** Inventory actors and slots share the Board-derived cell scale. */
	readonly actorSize: number;
	readonly surface: PixiGridSurfaceLayout;
}
