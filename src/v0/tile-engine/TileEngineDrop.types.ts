import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineDrop {
	export interface Registration<TSlot = unknown, TTile = unknown, TDrop = unknown> {
		dropId: string;
		slot: TileEngine.Slot<TSlot> | null;
		targetTile: TileEngine.Tile<TTile> | undefined;
		payload: TDrop;
		element: HTMLElement;
	}

	export type Resolved<TSlot = unknown, TTile = unknown, TDrop = unknown> = Registration<
		TSlot,
		TTile,
		TDrop
	>;
}
