import { createContext } from "react";

import type { PixiGameInteractionControl } from "~/ui/pixi/runtime/createPixiGameInteractionControlFx";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export interface PixiGameRuntimeCapabilities {
	readonly interaction: PixiGameInteractionControl;
	readonly textures: PixiTextureStore;
}

export const PixiGameRuntimeContext = createContext<PixiGameRuntimeCapabilities | undefined>(
	undefined,
);
