import { useContext } from "react";

import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";

/** Reads the active game menu control from the game-shell boundary. */
export const useGameMenuControl = () => {
	const control = useContext(GameMenuContext);
	if (control === undefined) {
		throw new Error("Game menu control is unavailable outside its provider.");
	}
	return control;
};
