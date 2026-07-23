import { createContext } from "react";

import type { TileSystem } from "~/ui/tile/TileSystem";
import type { useTileInteractionController } from "~/ui/tile/useTileInteractionController";

export type TileSystemApi = Omit<TileSystem, "active"> & {
	readonly refreshSlotTarget: ReturnType<
		typeof useTileInteractionController
	>["refreshSlotTarget"];
};

/** Stable Canvas API; active interaction selection is subscribed separately. */
export const TileSystemApiContext = createContext<TileSystemApi | null>(null);
