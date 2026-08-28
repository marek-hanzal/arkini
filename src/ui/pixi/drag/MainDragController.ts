import type { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface MainDragController {
	readonly attachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly detachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	/** Coalesces canonical/layout invalidation onto the current drag frame slot. */
	readonly requestRefreshFx: Effect.Effect<void>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
