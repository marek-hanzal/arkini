import type { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface CursorGrabMotion {
	readonly finishFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly startFx: (
		actor: PixiTileActor,
		pointer: {
			readonly x: number;
			readonly y: number;
		},
	) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
