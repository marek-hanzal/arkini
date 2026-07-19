import { createContext } from "react";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropIntent } from "~/ui/tile/TileDropIntent";
import type { TileDropOutcome } from "~/ui/tile/TileDropOutcome";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

export interface TileSystem {
	readonly active: TileInteractionState | null;
	readonly registerSurface: (surface: TileSurface, node: HTMLElement | null) => void;
	readonly registerSlot: (
		registration: {
			readonly surface: TileSurface;
			readonly slot: TileSlot;
			readonly occupant: TileIdentity | null;
		},
		node: HTMLElement | null,
	) => void;
	readonly press: (props: {
		readonly source: TileDragSource;
		readonly node: HTMLElement;
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
		readonly onDrop: (intent: TileDropIntent) => Promise<TileDropOutcome> | TileDropOutcome;
	}) => void;
	readonly move: (props: {
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
	}) => void;
	readonly release: (props: {
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
	}) => void;
	readonly cancel: (identity: TileIdentity) => void;
}

/** Headless tile interaction context. It owns gesture and animation state, never gameplay state. */
export const TileSystemContext = createContext<TileSystem | null>(null);
