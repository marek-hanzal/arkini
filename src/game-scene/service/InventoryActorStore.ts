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
	readonly closeFx: Effect.Effect<void>;
	readonly destroyRemovedFx: (actors: readonly PixiTileActor[]) => Effect.Effect<void>;
	readonly readActorFx: (itemId: string) => Effect.Effect<PixiTileActor | null>;
	readonly readOccupantFx: (target: InventoryDropTarget) => Effect.Effect<TileActorItem | null>;
	readonly reconcileFx: (transition: GameTransition) => Effect.Effect<InventoryReconciliation>;
	readonly refreshAppearanceFx: Effect.Effect<void>;
}
