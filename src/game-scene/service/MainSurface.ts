import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { GameTransition } from "~/game-session/type/GameSession";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export interface MainSurface extends MainInteractionSurface {
	readonly boardPresentationLayer: Container;
	readonly readBoardPoseFx: (
		location: BoardLocationSchema.Type,
	) => Effect.Effect<ActorPose | null, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly redrawFx: Effect.Effect<void, never, never>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void, never, never>;
	readonly setTransitionFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
}
