import { useContext } from "react";

import { GameEngineContext } from "~/ui/game/GameEngineContext";

/** Reads the exact Game Engine published by the active gameplay owner. */
export const useGameEngine = () => {
	const game = useContext(GameEngineContext);
	if (game === undefined) throw new Error("Game Engine provider is missing.");
	return game;
};
