import type { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export interface MainSurface extends MainInteractionSurface {
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly readLocationPoseFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<ActorPose | null, never, never>;
	readonly redrawFx: Effect.Effect<void, never, never>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void, never, never>;
	readonly setTransitionFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void, never, never>;
}
