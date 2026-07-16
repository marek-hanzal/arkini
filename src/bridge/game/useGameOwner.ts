import { useContext } from "react";

import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";

/** Reads the one root-shell game owner shared across package routes. */
export const useGameOwner = () => {
	const owner = useContext(GameOwnerContext);
	if (owner === undefined) throw new Error("Game owner is unavailable outside its provider.");
	return owner;
};
