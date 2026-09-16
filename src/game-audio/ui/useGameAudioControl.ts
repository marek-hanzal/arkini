import { useContext } from "react";

import { GameAudioContext } from "~/game-audio/context/GameAudioContext";

/** Reads the active Game route's direct audio capability. */
export const useGameAudioControl = () => {
	const control = useContext(GameAudioContext);
	if (control === undefined) {
		throw new Error("Game audio control is unavailable outside its provider.");
	}
	return control;
};
