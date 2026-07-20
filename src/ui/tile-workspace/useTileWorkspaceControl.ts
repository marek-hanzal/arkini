import { useContext } from "react";

import { TileWorkspaceContext } from "~/ui/tile-workspace/TileWorkspaceContext";

/** Reads the active tile-workspace lifecycle from the game-shell boundary. */
export const useTileWorkspaceControl = () => {
	const control = useContext(TileWorkspaceContext);
	if (control === undefined) {
		throw new Error("Tile workspace control is unavailable outside its provider.");
	}
	return control;
};
