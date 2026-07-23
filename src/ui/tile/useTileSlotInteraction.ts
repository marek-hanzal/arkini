import { useCallback, useSyncExternalStore } from "react";

import { useTileInteractionContext } from "~/ui/tile/useTileInteractionContext";

/** Subscribes only the exact slot currently crossed by a live drag. */
export const useTileSlotInteraction = (surfaceId: string, slotId: string) => {
	const { readActive, subscribeActive } = useTileInteractionContext();
	const readOver = useCallback(() => {
		const active = readActive();
		return (
			active?.phase === "dragging" &&
			active.target?.kind === "slot" &&
			active.target.surface.id === surfaceId &&
			active.target.slot.id === slotId
		);
	}, [
		readActive,
		slotId,
		surfaceId,
	]);
	return useSyncExternalStore(subscribeActive, readOver, readOver);
};
