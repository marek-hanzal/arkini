import { useCallback, useSyncExternalStore } from "react";
import { match } from "ts-pattern";

import { useTileInteractionContext } from "~/ui/tile/useTileInteractionContext";

/** Subscribes one actor only while the exact interaction generation owns it. */
export const useTileActorInteraction = (itemId: string) => {
	const { readActive, subscribeActive } = useTileInteractionContext();
	const readSelection = useCallback(() => {
		const active = readActive();
		const owned = match(active)
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
					source.id === itemId ||
					(target?.kind === "slot" && target.occupant?.id === itemId),
			)
			.with(
				{
					phase: "awaiting-outcome",
				},
				({ source, target }) =>
					source.id === itemId ||
					(target.kind === "slot" && target.occupant?.id === itemId),
			)
			.exhaustive();
		return owned ? active : null;
	}, [
		itemId,
		readActive,
	]);
	return useSyncExternalStore(subscribeActive, readSelection, readSelection);
};
