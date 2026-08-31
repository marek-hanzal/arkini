import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

export interface InventoryInteractionDropTarget {
	readonly x: number;
	readonly y: number;
}

export interface InventoryInteractionSurface {
	readonly actorLayer: Container;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<
		{
			readonly x: number;
			readonly y: number;
		} | null,
		never,
		never
	>;
	readonly readActorSizeFx: Effect.Effect<number, never, never>;
	readonly readDropTargetFx: (
		x: number,
		y: number,
	) => Effect.Effect<InventoryInteractionDropTarget | null, never, never>;
	readonly renderDropFeedbackFx: (
		target: InventoryInteractionDropTarget | null,
		kind: readDropItemPreviewFx.Result["kind"] | null,
	) => Effect.Effect<void, never, never>;
}
