import type { PackageGameEngine } from "~/bridge/game/GameEngine";
import { useGameEngine } from "~/bridge/game/useGameEngine";

/** Narrows the shared playable facade at installed-package-only route boundaries. */
export const usePackageGameEngine = () => {
	const game = useGameEngine();
	if (game.resourceMetadata.type !== "package") {
		throw new Error("Installed-package Game Engine is unavailable in this gameplay owner.");
	}
	return game as PackageGameEngine;
};
