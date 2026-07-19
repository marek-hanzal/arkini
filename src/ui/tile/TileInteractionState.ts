import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";

/** Minimal React-visible drag state; pointer coordinates remain outside React. */
export interface TileInteractionState {
	readonly source: TileDragSource;
	readonly phase: "pressed" | "dragging" | "settling";
	readonly target: TileDropTarget | null;
}
