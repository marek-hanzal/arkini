import { useContext } from "react";

import { TileSystemContext } from "~/ui/tile/TileSystemContext";

/** Reads the one Canvas-local tile system for focused domain hooks. */
export const useTileSystemContext = () => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	return system;
};
