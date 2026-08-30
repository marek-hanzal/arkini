import type { Effect } from "effect";

import type { InventoryInteractionSurface } from "~/tile-interaction/type/InventoryInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

export interface InventoryActorPose {
	readonly x: number;
	readonly y: number;
}

export interface InventoryDropTarget {
	readonly x: number;
	readonly y: number;
}

export interface InventorySurface extends InventoryInteractionSurface {
	readonly closeFx: Effect.Effect<void>;
	readonly readPaletteFx: Effect.Effect<PixiScenePalette>;
	readonly redrawFx: Effect.Effect<void>;
	readonly refreshPaletteFx: Effect.Effect<void>;
}
