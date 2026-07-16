import { useContext } from "react";

import { GameContext } from "~/bridge/game/GameContext";

/** Reads the one live game instance owned by the nearest game shell. */
export const useGame = () => {
	const game = useContext(GameContext);
	if (game === null) throw new Error("GameProvider is missing.");
	return game;
};
