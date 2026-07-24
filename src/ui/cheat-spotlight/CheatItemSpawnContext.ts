import { createContext } from "react";

import type { CheatItemSpawnCommandAtom } from "~/ui/cheat-spotlight/CheatItemSpawnCommandAtom";

export interface CheatItemSpawnControl {
	readonly pending: boolean;
	readonly request: (itemId: string) => void;
	readonly reset: () => void;
	readonly state: CheatItemSpawnCommandAtom.State;
}

export const CheatItemSpawnContext = createContext<CheatItemSpawnControl | null>(null);
