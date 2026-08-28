import { createContext } from "react";

import type { PixiGameInteractionControl } from "~/ui/pixi/runtime/createGameInteractionControlFx";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export interface PixiGameRuntimeCapabilities {
	readonly interaction: PixiGameInteractionControl;
	readonly textures: PixiTextureStore;
}

export const PixiGameRuntimeContext = createContext<PixiGameRuntimeCapabilities | undefined>(
	undefined,
);
