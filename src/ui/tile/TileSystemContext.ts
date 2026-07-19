import { createContext } from "react";

import type { useDropItem } from "~/bridge/tile/useDropItem";
import type { TileActorPlacement } from "~/ui/tile/TileActorPlacement";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

export interface TileSystem {
	readonly active: TileInteractionState | null;
	readonly geometryVersion: number;
	readonly registerActorLayer: (node: HTMLElement | null) => void;
	readonly registerSurface: (surface: TileSurface, node: HTMLElement | null) => void;
	readonly registerSlot: (
		registration: {
			readonly surface: TileSurface;
			readonly slot: TileSlot;
			readonly occupant: TileIdentity | null;
		},
		node: HTMLElement | null,
	) => void;
	readonly readPlacement: (source: TileDragSource) => TileActorPlacement | null;
	readonly press: (source: TileDragSource) => boolean;
	readonly startDrag: (source: TileDragSource) => void;
	readonly moveDrag: (source: TileDragSource, x: number, y: number) => void;
	readonly release: (itemId: string) => {
		readonly source: TileDragSource;
		readonly generation: number;
		readonly target: TileDropTarget;
	} | null;
	readonly settle: (
		source: TileDragSource,
		generation: number,
		outcome: useDropItem.Result | null,
	) => void;
	readonly complete: (itemId: string, generation: number) => void;
	readonly cancel: (itemId: string) => void;
}

/** One Canvas-local tile interaction owner. Motion renders targets; this context owns meaning. */
export const TileSystemContext = createContext<TileSystem | null>(null);
