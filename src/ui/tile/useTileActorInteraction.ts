import { useCallback, useSyncExternalStore } from "react";
import { match } from "ts-pattern";

import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { useTileInteractionContext } from "~/ui/tile/useTileInteractionContext";

const ownsActor = (active: TileInteractionState | null, itemId: string) =>
	match(active)
		.with(null, () => false)
		.with(
			{
				phase: "pressed",
			},
			({ source }) => source.id === itemId,
		)
		.with(
			{
				phase: "dragging",
			},
			({ source, target }) =>
				source.id === itemId || (target?.kind === "slot" && target.occupant?.id === itemId),
		)
		.with(
			{
				phase: "awaiting-outcome",
			},
			({ source, target }) =>
				source.id === itemId || (target.kind === "slot" && target.occupant?.id === itemId),
		)
		.with(
			{
				phase: "settling",
			},
			({ settlement }) =>
				settlement.pendingActorIds.includes(itemId) ||
				(settlement.kind === "store-input" && settlement.outcome.owner.itemId === itemId) ||
				(settlement.kind === "merge" && settlement.outcome.target.itemId === itemId) ||
				("target" in settlement &&
					settlement.target.kind === "slot" &&
					settlement.target.occupant?.id === itemId),
		)
		.exhaustive();

/** Subscribes one actor only while the exact interaction generation owns it. */
export const useTileActorInteraction = (itemId: string) => {
	const { readActive, subscribeActive } = useTileInteractionContext();
	const readSelection = useCallback(() => {
		const active = readActive();
		return ownsActor(active, itemId) ? active : null;
	}, [
		itemId,
		readActive,
	]);
	return useSyncExternalStore(subscribeActive, readSelection, readSelection);
};
