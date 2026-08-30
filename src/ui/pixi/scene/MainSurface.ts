import type { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export type TargetFacts = Effect.Success<ReturnType<MainInteractionSurface["readTargetFactsFx"]>>;

export interface MainSurface extends MainInteractionSurface {
	readonly closeFx: Effect.Effect<void>;
	readonly readLocationPoseFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<ActorPose | null>;
	readonly redrawFx: Effect.Effect<void>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void>;
	readonly setTransitionFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
}
