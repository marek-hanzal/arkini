import type { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

/** Owns the non-interactive visual anchor left behind by one active main-scene drag. */
export interface DragOriginGhosts {
	readonly beginFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly settleFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
