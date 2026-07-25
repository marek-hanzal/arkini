import type { Container } from "pixi.js";
import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";

export interface PixiInventoryActorPose {
	readonly x: number;
	readonly y: number;
}

export interface PixiInventorySceneSurface {
	readonly actorLayer: Container;
	readonly closeFx: Effect.Effect<void>;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<PixiInventoryActorPose | null>;
	readonly readActorSizeFx: Effect.Effect<number>;
	readonly readDropTargetFx: (
		x: number,
		y: number,
	) => Effect.Effect<PixiInventoryDropTarget | null>;
	readonly readPaletteFx: Effect.Effect<PixiScenePalette>;
	readonly redrawFx: Effect.Effect<void>;
	readonly refreshPaletteFx: Effect.Effect<void>;
	readonly renderDropFeedbackFx: (
		target: PixiInventoryDropTarget | null,
		kind: readTileDropPreviewFx.Result["kind"] | null,
	) => Effect.Effect<void>;
}
