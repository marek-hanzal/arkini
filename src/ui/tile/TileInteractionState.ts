import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";

/** Arkini-owned presentation state for the one active tile gesture or settlement. */
export interface TileInteractionState {
	readonly source: TileDragSource;
	readonly generation: number;
	readonly phase: "pressed" | "dragging" | "awaiting-outcome" | "settling";
	readonly target: TileDropTarget | null;
	readonly settleLocation: TileLocation | null;
	readonly feedback: "accepted" | "rejected" | "ignored" | null;
}
