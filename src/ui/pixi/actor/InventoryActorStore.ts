import type { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { InventoryDropTarget } from "~/ui/pixi/scene/InventoryDropTarget";

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

export interface InventoryReconciliation {
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
