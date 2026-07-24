import type { QueryClient } from "@tanstack/react-query";

import type { GameEngineAcquisitionOwner } from "~/bridge/game/GameEngineAcquisitionOwner";

/** The one renderer registry for provisional or terminal-critical Game Engine ownership. */
export const gameEngineAcquisitionOwners = new WeakMap<QueryClient, GameEngineAcquisitionOwner>();
