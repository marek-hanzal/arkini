import { use } from "react";

import { CheatItemSpawnContext } from "~/ui/cheat-spotlight/CheatItemSpawnContext";

/** Reads the Game-route-scoped Cheat spawn owner. */
export const useCheatItemSpawn = () => {
	const control = use(CheatItemSpawnContext);
	if (control === null) throw new Error("CheatItemSpawnProvider is not mounted.");
	return control;
};
