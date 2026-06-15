import { useCallback, useRef } from "react";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";

export namespace useTileEngineHandoff {
	export interface Result {
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}
}

export const useTileEngineHandoff = (): useTileEngineHandoff.Result => {
	const handoffRef = useRef<TileEngineActor.Handoff | null>(null);

	const setHandoff = useCallback((handoff: TileEngineActor.Handoff | null) => {
		handoffRef.current = handoff;
	}, []);
	const consumeHandoff = useCallback((tileId: string, slotId: string) => {
		const handoff = handoffRef.current;
		if (!handoff || handoff.tileId !== tileId || handoff.targetSlotId !== slotId) {
			return false;
		}
		handoffRef.current = null;
		return true;
	}, []);

	return {
		setHandoff,
		consumeHandoff,
	};
};
