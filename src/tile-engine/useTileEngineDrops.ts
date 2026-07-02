import { useCallback } from "react";
import { readTileEngineDrops, registerTileEngineDrop } from "~/tile-engine/dropRegistry";
import { resolveDropAtRect } from "~/tile-engine/resolveDropAtRect";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useTileEngineDrops {
	export interface Result<TSlot = unknown, TTile = unknown, TDrop = unknown> {
		registerDrop(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>): () => void;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
	}
}

export const useTileEngineDrops = <TSlot, TTile, TDrop>(): useTileEngineDrops.Result<
	TSlot,
	TTile,
	TDrop
> => {
	const registerDrop = useCallback(
		(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>) => registerTileEngineDrop(entry),
		[],
	);
	const resolveDrop = useCallback(
		(rect: TileEngine.Rect) =>
			resolveDropAtRect(
				readTileEngineDrops() as ReadonlyMap<
					string,
					TileEngineDrop.Registration<TSlot, TTile, TDrop>
				>,
				rect,
			),
		[],
	);

	return {
		registerDrop,
		resolveDrop,
	};
};
