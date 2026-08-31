import type { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { InventoryDropTarget } from "~/game-scene/service/InventorySurface";

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

interface InventoryReconciliation {
	readonly created: readonly PixiTileActor[];
	readonly items: readonly TileActorItem[];
	readonly removed: readonly PixiTileActor[];
}

export interface InventoryActorStore {
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly destroyRemovedFx: (
		actors: readonly PixiTileActor[],
	) => Effect.Effect<void, never, never>;
	readonly readActorFx: (itemId: string) => Effect.Effect<PixiTileActor | null, never, never>;
	readonly readOccupantFx: (
		target: InventoryDropTarget,
	) => Effect.Effect<TileActorItem | null, never, never>;
	readonly reconcileFx: (
		transition: GameTransition,
	) => Effect.Effect<InventoryReconciliation, never, never>;
	readonly refreshAppearanceFx: Effect.Effect<void, never, never>;
}
