import { createContext } from "react";

import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";

/** Game-only menu state. It exists only while the active game shell is mounted. */
export const GameMenuContext = createContext<GameMenuControl | undefined>(undefined);
