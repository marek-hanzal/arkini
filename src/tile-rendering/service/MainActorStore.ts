import type { Effect } from "effect";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

export interface MainActorStore {
	readonly actors: ReadonlyMap<string, PixiTileActor>;
	readonly canonicalItems: ReadonlyMap<string, TileActorItem>;
	readonly deleteActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null, never, never>;
	readonly destroyExitingActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly readActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null, never, never>;
	readonly readCanonicalItemFx: (
		actorId: string,
	) => Effect.Effect<TileActorItem | null, never, never>;
	/** Reads one canonical active-scene anchor without scanning the retained projection. */
	readonly readCanonicalOccupantFx: (
		location: TileActorItem["location"],
	) => Effect.Effect<TileActorItem | null, never, never>;
	/** Reads unique canonical occupants in caller-provided deterministic slot order. */
	readonly readCanonicalOccupantsFx: (
		locations: ReadonlyArray<TileActorItem["location"]>,
	) => Effect.Effect<ReadonlyArray<TileActorItem>, never, never>;
	readonly releaseActorFx: (actorId: string) => Effect.Effect<PixiTileActor | null, never, never>;
	readonly replaceCanonicalItemsFx: (
		items: ReadonlyArray<TileActorItem>,
	) => Effect.Effect<void, never, never>;
	readonly setActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
