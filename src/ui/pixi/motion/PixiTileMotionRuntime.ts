import type { Effect } from "effect";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export interface PixiTileMotionSnapshot {
	readonly ownedActorIds: ReadonlySet<string>;
	readonly spawnCueByActorId: ReadonlyMap<
		string,
		Extract<
			TileMotionCue,
			{
				readonly kind: "spawn";
			}
		>
	>;
	readonly unsettledQuantities: ReadonlyMap<string, number>;
}

export interface PixiTileMotionRuntime {
	readonly enqueueFx: (cues: ReadonlyArray<TileMotionCue>) => Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<PixiTileMotionSnapshot>;
	readonly startFx: Effect.Effect<void>;
	readonly syncQuantitiesFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
