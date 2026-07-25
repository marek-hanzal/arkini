import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface PixiMainSceneActorStore {
	readonly actors: ReadonlyMap<string, PixiTileActor>;
	readonly canonicalItems: ReadonlyMap<string, TileActorItem>;
	readonly deleteActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null>;
	readonly readActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null>;
	readonly readCanonicalItemFx: (actorId: string) => Effect.Effect<TileActorItem | null>;
	readonly replaceCanonicalItemsFx: (items: ReadonlyArray<TileActorItem>) => Effect.Effect<void>;
	readonly setActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
