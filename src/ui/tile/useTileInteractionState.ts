import { useSyncExternalStore } from "react";

import { useTileInteractionContext } from "~/ui/tile/useTileInteractionContext";

/** Subscribes to the complete interaction only for the actor-layer lifecycle owner. */
export const useTileInteractionState = () => {
	const { readActive, subscribeActive } = useTileInteractionContext();
	return useSyncExternalStore(subscribeActive, readActive, readActive);
};
