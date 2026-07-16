import { createContext } from "react";

import type { createGameOwner } from "~/bridge/game/createGameOwner";

/** Root-shell context for the one serialized live-game owner. */
export const GameOwnerContext = createContext<createGameOwner.Owner | undefined>(undefined);
