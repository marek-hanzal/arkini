import { createContext } from "react";

import type { useTileGeometry } from "~/ui/tile/useTileGeometry";
import type { useTileInteractionController } from "~/ui/tile/useTileInteractionController";
import type { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";

export type TileSystem = Omit<ReturnType<typeof useTileGeometry>, "resolveTarget"> &
	ReturnType<typeof useTileInteractionController> &
	ReturnType<typeof useTileNeighbourField>;

/** One Canvas-local tile interaction owner. Motion renders targets; this context owns meaning. */
export const TileSystemContext = createContext<TileSystem | null>(null);
