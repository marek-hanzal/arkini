import { createContext } from "react";

import type { GameInteractionControl } from "~/tile-interaction/fx/createGameInteractionControlFx";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export interface GameRuntimeCapabilities {
	readonly interaction: GameInteractionControl;
	readonly textures: TextureStore;
}

export const PixiGameRuntimeContext = createContext<GameRuntimeCapabilities | undefined>(undefined);
