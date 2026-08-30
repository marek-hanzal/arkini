import { useContext } from "react";

import type { PackageGameEngine } from "~/renderer/game/GameEngine";
import { GameEngineContext } from "~/game-presentation/context/GameEngineContext";

/** Reads the exact Game Engine published by the active gameplay owner. */
export const useGameEngine = () => {
	const game = useContext(GameEngineContext);
	if (game === undefined) throw new Error("Game Engine provider is missing.");
	return game;
};

/** Narrows the shared playable capability at installed-package-only route boundaries. */
export const usePackageGameEngine = () => {
	const game = useGameEngine();
	if (!("arkpack" in game) || !("saveKey" in game)) {
		throw new Error("Installed-package Game Engine is unavailable in this gameplay owner.");
	}
	return game as PackageGameEngine;
};
