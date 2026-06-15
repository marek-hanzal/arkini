import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";

const drops = new Map<string, TileEngineDrop.Registration>();

export const registerTileEngineDrop = <TSlot = unknown, TTile = unknown, TDrop = unknown>(
	entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>,
) => {
	drops.set(entry.dropId, entry as TileEngineDrop.Registration);

	return () => {
		const current = drops.get(entry.dropId);
		if (current === entry) drops.delete(entry.dropId);
	};
};

export const readTileEngineDrops = () => drops as ReadonlyMap<string, TileEngineDrop.Registration>;
