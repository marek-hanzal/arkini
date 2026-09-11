import type { Effect } from "effect";

import type { GameTransition } from "~/game-session/type/GameSession";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export interface MainSurface extends MainInteractionSurface {
	readonly setInteractionLayerFx: (
		layer: TileActorItem["layer"],
	) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly readLocationPoseFx: (
		location: TileActorItem["location"],
		layer?: TileActorItem["layer"],
	) => Effect.Effect<ActorPose | null, never, never>;
	readonly redrawFx: Effect.Effect<void, never, never>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void, never, never>;
	readonly setTransitionFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
}
