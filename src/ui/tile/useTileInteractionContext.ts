import { useContext } from "react";

import { TileInteractionContext } from "~/ui/tile/TileInteractionContext";

/** Reads the focused Canvas interaction subscription owner. */
export const useTileInteractionContext = () => {
	const interaction = useContext(TileInteractionContext);
	if (interaction === null) throw new Error("TileSystemProvider is missing.");
	return interaction;
};
