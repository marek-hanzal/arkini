import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export interface PixiMainSceneSurface {
	readonly transientActorLayer: Container;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<PixiTileActorPose | null>;
	readonly readCommandTargetFx: (
		target: PixiSceneDropTarget | null,
	) => Effect.Effect<runTileDropAtom.Command["target"]>;
	readonly readDropTargetFx: (x: number, y: number) => Effect.Effect<PixiSceneDropTarget | null>;
	readonly readLocationPoseFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<PixiTileActorPose | null>;
	readonly readOccupantFx: (target: PixiSceneDropTarget) => Effect.Effect<TileActorItem | null>;
	readonly redrawFx: Effect.Effect<void>;
	readonly renderDropFeedbackFx: (
		target: PixiSceneDropTarget | null,
		kind: readTileDropPreviewFx.Result["kind"] | null,
	) => Effect.Effect<void>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void>;
	readonly setTransitionFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
}
