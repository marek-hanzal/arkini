import { useMemo } from "react";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useTileEngineIndexes {
	export interface Props<TTile = unknown, TSlot = unknown> {
		columns: number;
		slots: readonly TileEngine.Slot<TSlot>[];
		tiles: readonly TileEngine.Tile<TTile>[];
	}

	export interface Result<TTile = unknown> {
		rowCount: number;
		tileBySlotId: ReadonlyMap<string, TileEngine.Tile<TTile>>;
		slotIndexById: ReadonlyMap<string, number>;
	}
}

export const useTileEngineIndexes = <TTile, TSlot>({
	columns,
	slots,
	tiles,
}: useTileEngineIndexes.Props<TTile, TSlot>): useTileEngineIndexes.Result<TTile> => {
	const rowCount = Math.max(1, Math.ceil(slots.length / columns));
	const tileBySlotId = useMemo(() => {
		const map = new Map<string, TileEngine.Tile<TTile>>();
		for (const tile of tiles) map.set(tile.slotId, tile);
		return map;
	}, [
		tiles,
	]);
	const slotIndexById = useMemo(() => {
		const map = new Map<string, number>();
		slots.forEach((slot, index) => map.set(slot.id, index));
		return map;
	}, [
		slots,
	]);

	return {
		rowCount,
		tileBySlotId,
		slotIndexById,
	};
};
