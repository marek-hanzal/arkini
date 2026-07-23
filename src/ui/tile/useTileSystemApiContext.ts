import { useContext } from "react";

import { TileSystemApiContext } from "~/ui/tile/TileSystemApiContext";

/** Reads stable Canvas commands and geometry independently of active selection. */
export const useTileSystemApiContext = () => {
	const system = useContext(TileSystemApiContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	return system;
};
