import type { Effect } from "effect";

import type { TileDelivery } from "~/bridge/tile/readTileDeliveriesFx";

export interface PixiDeliveryMotionSnapshot {
	readonly retainedActorIds: ReadonlySet<string>;
}

/** Main-scene owner for canonical delivery actors and generation-guarded settlement. */
export interface PixiDeliveryMotionRuntime {
	readonly closeFx: Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<PixiDeliveryMotionSnapshot>;
	readonly syncFx: (deliveries: ReadonlyArray<TileDelivery>) => Effect.Effect<void>;
}
