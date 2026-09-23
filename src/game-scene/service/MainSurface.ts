import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { GameTransition } from "~/game-session/type/GameSession";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

export interface MainSurface extends MainInteractionSurface {
	readonly boardPresentationLayer: Container;
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly redrawFx: Effect.Effect<void, never, never>;
	readonly setPaletteFx: (palette: PixiScenePalette) => Effect.Effect<void, never, never>;
	readonly setTransitionFx: (transition: GameTransition) => Effect.Effect<void, never, never>;
}
