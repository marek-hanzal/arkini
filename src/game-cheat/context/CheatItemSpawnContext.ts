import { createContext } from "react";

import type { CheatItemSpawnCommandAtom } from "~/game-cheat/atom/CheatItemSpawnCommandAtom";

export interface CheatItemSpawnControl {
	readonly pending: boolean;
	readonly requestFn: (itemId: string) => void;
	readonly resetFn: () => void;
	readonly state: CheatItemSpawnCommandAtom.State;
}

export const CheatItemSpawnContext = createContext<CheatItemSpawnControl | null>(null);
