import { Exit } from "effect";
import { useMemo } from "react";

import type { Game } from "~/bridge/game/Game";
import { readCheatItemCatalogFx } from "~/engine/cheat/read/readCheatItemCatalogFx";

/** Resolves the static engine-owned Cheat Spotlight catalog and package resource URLs. */
export const useCheatItemCatalog = (game: Game) =>
	useMemo(() => {
		const exit = game.read(readCheatItemCatalogFx());
		if (Exit.isFailure(exit)) throw exit.cause;
		return exit.value.map((entry) => ({
			...entry,
			sourceUrl: game.getResourceUrl(entry.sourceResourceId),
		}));
	}, [
		game,
	]);
