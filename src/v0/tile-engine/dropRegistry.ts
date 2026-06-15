import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export interface TileEngineDropRegistration<TSlot = unknown, TTile = unknown, TDrop = unknown> {
	dropId: string;
	slot: TileEngine.Slot<TSlot> | null;
	targetTile: TileEngine.Tile<TTile> | undefined;
	payload: TDrop;
	element: HTMLElement;
}

const drops = new Map<string, TileEngineDropRegistration>();

export const registerTileEngineDrop = <TSlot = unknown, TTile = unknown, TDrop = unknown>(
	entry: TileEngineDropRegistration<TSlot, TTile, TDrop>,
) => {
	drops.set(entry.dropId, entry as TileEngineDropRegistration);

	return () => {
		const current = drops.get(entry.dropId);
		if (current === entry) drops.delete(entry.dropId);
	};
};

export const readTileEngineDrops = () => drops as ReadonlyMap<string, TileEngineDropRegistration>;
