import type { Effect } from "effect";

import type { TileDelivery } from "~/ui/pixi/delivery/readTileDeliveriesFx";

export interface DeliverySnapshot {
	readonly retainedActorIds: ReadonlySet<string>;
}

/** Main-scene owner for presentation-only canonical delivery actors and travel. */
export interface DeliveryRuntime {
	readonly closeFx: Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<DeliverySnapshot>;
	readonly syncFx: (deliveries: ReadonlyArray<TileDelivery>) => Effect.Effect<void>;
}
