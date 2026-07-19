import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";

/** One presentation drop fact before a surface-specific adapter selects a command. */
export interface TileDropIntent {
	readonly source: TileDragSource;
	readonly target: TileDropTarget;
	readonly pointer: {
		readonly x: number;
		readonly y: number;
	};
}
