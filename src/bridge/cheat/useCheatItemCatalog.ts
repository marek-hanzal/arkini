import { useMemo } from "react";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readCheatItemCatalogFx } from "~/engine/cheat/read/readCheatItemCatalogFx";

/** Resolves the static engine-owned Cheat Spotlight catalog and package resource URLs. */
export const useCheatItemCatalog = (game: GameEngine) =>
	useMemo(() => {
		return game.readOrThrow(readCheatItemCatalogFx()).map((entry) => ({
			...entry,
			sourceUrl: game.getResourceUrl(entry.sourceResourceId),
		}));
	}, [
		game,
	]);
