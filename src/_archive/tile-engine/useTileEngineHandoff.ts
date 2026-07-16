import { useCallback, useRef } from "react";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

export namespace useTileEngineHandoff {
	export interface Result {
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
		setHandoffs(handoffs: readonly TileEngineActor.Handoff[]): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}
}

const matchesHandoff = ({
	handoff,
	slotId,
	tileId,
}: {
	handoff: TileEngineActor.Handoff;
	slotId: string;
	tileId: string;
}) => handoff.tileId === tileId && handoff.targetSlotId === slotId;

export const useTileEngineHandoff = (): useTileEngineHandoff.Result => {
	const handoffsRef = useRef<TileEngineActor.Handoff[]>([]);

	const setHandoff = useCallback((handoff: TileEngineActor.Handoff | null) => {
		handoffsRef.current = handoff
			? [
					handoff,
				]
			: [];
	}, []);
	const setHandoffs = useCallback((handoffs: readonly TileEngineActor.Handoff[]) => {
		handoffsRef.current = [
			...handoffs,
		];
	}, []);
	const consumeHandoff = useCallback((tileId: string, slotId: string) => {
		const index = handoffsRef.current.findIndex((handoff) =>
			matchesHandoff({
				handoff,
				slotId,
				tileId,
			}),
		);
		if (index === -1) return false;

		handoffsRef.current.splice(index, 1);
		return true;
	}, []);

	return {
		setHandoff,
		setHandoffs,
		consumeHandoff,
	};
};
