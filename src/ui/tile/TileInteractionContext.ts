import { createContext } from "react";

import type { TileInteractionState } from "~/ui/tile/TileInteractionState";

export interface TileInteractionSubscription {
	readonly readActive: () => TileInteractionState | null;
	readonly subscribeActive: (listener: () => void) => () => void;
}

/** Stable subscription boundary for Canvas-local interaction selections. */
export const TileInteractionContext = createContext<TileInteractionSubscription | null>(null);
