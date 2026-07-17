import { createContext } from "react";

import type { GameOwner } from "~/bridge/game/GameOwner";

/** Root-shell context for the one serialized live-game owner. */
export const GameOwnerContext = createContext<GameOwner | undefined>(undefined);
