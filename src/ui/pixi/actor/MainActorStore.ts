import type { Effect } from "effect";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface MainActorStore {
	readonly actors: ReadonlyMap<string, PixiTileActor>;
	readonly canonicalItems: ReadonlyMap<string, TileActorItem>;
	readonly deleteActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null>;
	readonly destroyExitingActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly readActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null>;
	readonly readCanonicalItemFx: (actorId: string) => Effect.Effect<TileActorItem | null>;
	/** Reads one canonical active-scene anchor without scanning the retained projection. */
	readonly readCanonicalOccupantFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<TileActorItem | null>;
	/** Reads unique canonical occupants in caller-provided deterministic slot order. */
	readonly readCanonicalOccupantsFx: (
		locations: ReadonlyArray<TileActorItem["location"]>,
	) => Effect.Effect<ReadonlyArray<TileActorItem>>;
	readonly releaseActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null>;
	readonly replaceCanonicalItemsFx: (items: ReadonlyArray<TileActorItem>) => Effect.Effect<void>;
	readonly setActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
