import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace createTileDropHandoffs {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		sourceTile: TileEngine.Tile<TTile>;
		resolved: TileEngineDrop.Resolved<TSlot, TTile, TDrop>;
		includeTarget: boolean;
	}

	export interface Result {
		source: TileEngineActor.Handoff | undefined;
		target: TileEngineActor.Handoff | undefined;
		all: readonly TileEngineActor.Handoff[];
	}
}

export const createTileDropHandoffs = <TTile, TSlot, TDrop>({
	sourceTile,
	resolved,
	includeTarget,
}: createTileDropHandoffs.Props<TTile, TSlot, TDrop>): createTileDropHandoffs.Result => {
	const source = resolved.slot
		? {
				tileId: sourceTile.id,
				targetSlotId: resolved.slot.id,
			}
		: undefined;
	const target = resolved.targetTile
		? {
				tileId: resolved.targetTile.id,
				targetSlotId: sourceTile.slotId,
			}
		: undefined;

	return {
		source,
		target,
		all: [
			source,
			includeTarget ? target : undefined,
		].filter((handoff): handoff is TileEngineActor.Handoff => Boolean(handoff)),
	};
};
