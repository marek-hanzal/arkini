import type { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

export interface PixiInventoryActorReconciliation {
	readonly created: readonly PixiTileActor[];
	readonly items: readonly TileActorItem[];
	readonly removed: readonly PixiTileActor[];
}

export interface PixiInventoryActorStore {
	readonly closeFx: Effect.Effect<void>;
	readonly destroyRemovedFx: (actors: readonly PixiTileActor[]) => Effect.Effect<void>;
	readonly readActorFx: (itemId: string) => Effect.Effect<PixiTileActor | null>;
	readonly readOccupantFx: (
		target: PixiInventoryDropTarget,
	) => Effect.Effect<TileActorItem | null>;
	readonly reconcileFx: (
		transition: GameTransition,
	) => Effect.Effect<PixiInventoryActorReconciliation>;
	readonly refreshAppearanceFx: Effect.Effect<void>;
}
