import type { PackageGameEngine } from "~/renderer/game/GameEngine";
import { useGameEngine } from "~/ui/game/useGameEngine";

/** Narrows the shared playable capability at installed-package-only route boundaries. */
export const usePackageGameEngine = () => {
	const game = useGameEngine();
	if (!("arkpack" in game) || !("saveKey" in game)) {
		throw new Error("Installed-package Game Engine is unavailable in this gameplay owner.");
	}
	return game as PackageGameEngine;
};
