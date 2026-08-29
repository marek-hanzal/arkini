import { createContext } from "react";

import type { GameEngine } from "~/renderer/game/GameEngine";

/** Exact playable session injected by a game or editor-game ownership boundary. */
export const GameEngineContext = createContext<GameEngine | undefined>(undefined);
