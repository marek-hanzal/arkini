import type { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface PixiMainSceneDragController {
	readonly attachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly detachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly refreshPreviewFx: Effect.Effect<void>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
