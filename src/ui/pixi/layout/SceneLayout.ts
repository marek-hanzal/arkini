export interface SurfaceLayout {
	readonly cellSize: number;
	readonly columns: number;
	readonly height: number;
	readonly kind: "board" | "inventory" | "toolbar";
	readonly rows: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface MainLayout {
	readonly board: SurfaceLayout;
	readonly toolbar: SurfaceLayout | null;
	readonly toolbarGap: number;
	readonly viewportPadding: number;
}

export interface InventoryLayout {
	/** Inventory actors and slots share the Board-derived cell scale. */
	readonly actorSize: number;
	readonly surface: SurfaceLayout;
}
