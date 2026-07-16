import { createContext } from "react";

import type { Game } from "~/bridge/game/Game";

/** React context carrying exactly one live game instance. */
export const GameContext = createContext<Game | null>(null);
