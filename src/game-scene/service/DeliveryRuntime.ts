import type { Effect } from "effect";

import type { TileDelivery } from "~/game-scene/fx/readTileDeliveriesFx";

interface DeliverySnapshot {
	readonly retainedActorIds: ReadonlySet<string>;
}

/** Main-scene owner for presentation-only canonical delivery actors and travel. */
export interface DeliveryRuntime {
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly readSnapshotFx: Effect.Effect<DeliverySnapshot, never, never>;
	readonly syncFx: (deliveries: ReadonlyArray<TileDelivery>) => Effect.Effect<void, never, never>;
}
