import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export interface TargetFacts {
	readonly commandTarget: runTileDropAtom.Command["target"];
	readonly occupant: TileActorItem | null;
	readonly stableKey: string;
	readonly target: PixiSceneDropTarget | null;
}

export interface MainSurface {
	readonly transientActorLayer: Container;
	readonly closeFx: Effect.Effect<void>;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<ActorPose | null>;
	/** Resolves pointer geometry and canonical target identity from one current snapshot. */
	readonly readTargetFactsFx: (x: number, y: number) => Effect.Effect<TargetFacts>;
	readonly readLocationPoseFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<ActorPose | null>;
	/** Returns stable canonical actor IDs in Board-then-Toolbar grid order. */
	readonly readLocalActorIdsFx: (bounds: {
		readonly excludeActorId?: string;
		readonly height: number;
		/** Expands per surface using the larger of source size and destination cell size. */
		readonly paddingRatio?: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	}) => Effect.Effect<ReadonlyArray<string>>;
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
