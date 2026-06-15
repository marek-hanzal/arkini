import { useCallback, useRef } from "react";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";

export namespace useTileEngineHandoff {
	export interface Result {
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
		setHandoffs(handoffs: readonly TileEngineActor.Handoff[]): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}
}

const handoffKey = (tileId: string, slotId: string) => `${tileId}::${slotId}`;

export const useTileEngineHandoff = (): useTileEngineHandoff.Result => {
	const handoffRef = useRef<Map<string, TileEngineActor.Handoff>>(new Map());

	const setHandoff = useCallback((handoff: TileEngineActor.Handoff | null) => {
		handoffRef.current = handoff
			? new Map([
					[
						handoffKey(handoff.tileId, handoff.targetSlotId),
						handoff,
					],
				])
			: new Map();
	}, []);
	const setHandoffs = useCallback((handoffs: readonly TileEngineActor.Handoff[]) => {
		handoffRef.current = new Map(
			handoffs.map((handoff) => [
				handoffKey(handoff.tileId, handoff.targetSlotId),
				handoff,
			]),
		);
	}, []);
	const consumeHandoff = useCallback((tileId: string, slotId: string) => {
		const key = handoffKey(tileId, slotId);
		if (!handoffRef.current.has(key)) return false;

		handoffRef.current.delete(key);
		return true;
	}, []);

	return {
		setHandoff,
		setHandoffs,
		consumeHandoff,
	};
};
