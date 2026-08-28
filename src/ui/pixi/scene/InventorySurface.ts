import type { Container } from "pixi.js";
import type { Effect } from "effect";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { InventoryDropTarget } from "~/ui/pixi/scene/InventoryDropTarget";

export interface InventoryActorPose {
	readonly x: number;
	readonly y: number;
}

export interface InventorySurface {
	readonly actorLayer: Container;
	readonly closeFx: Effect.Effect<void>;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<InventoryActorPose | null>;
	readonly readActorSizeFx: Effect.Effect<number>;
	readonly readDropTargetFx: (x: number, y: number) => Effect.Effect<InventoryDropTarget | null>;
	readonly readPaletteFx: Effect.Effect<PixiScenePalette>;
	readonly redrawFx: Effect.Effect<void>;
	readonly refreshPaletteFx: Effect.Effect<void>;
	readonly renderDropFeedbackFx: (
		target: InventoryDropTarget | null,
		kind: readTileDropPreviewFx.Result["kind"] | null,
	) => Effect.Effect<void>;
}
