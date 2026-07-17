import { createContext } from "react";

import type { createGameOwnerFx } from "~/bridge/game/createGameOwnerFx";

/** Root-shell context for the one serialized live-game owner. */
export const GameOwnerContext = createContext<createGameOwnerFx.Owner | undefined>(undefined);
