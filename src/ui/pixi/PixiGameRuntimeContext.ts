import { createContext } from "react";

import type { GameInteractionControl } from "~/tile-interaction/fx/createGameInteractionControlFx";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export interface GameRuntimeCapabilities {
	readonly interaction: GameInteractionControl;
	readonly textures: TextureStore;
}

export const PixiGameRuntimeContext = createContext<GameRuntimeCapabilities | undefined>(undefined);
