import type { Effect } from "effect";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

/** Presentation ownership of dragging; ordinary click activation always remains available. */
export type PixiTileInteractionClaim = "activation-only" | "handoff";

export interface PixiTileMotionSnapshot {
	readonly interactionClaimByActorId: ReadonlyMap<string, PixiTileInteractionClaim>;
	/** Actors kept alive until every presentation cue that references them has settled. */
	readonly retainedActorIds: ReadonlySet<string>;
	readonly spawnCueByActorId: ReadonlyMap<
		string,
		Extract<
			TileMotionCue,
			{
				readonly kind: "spawn";
			}
		>
	>;
	readonly unsettledInputSourceQuantities: ReadonlyMap<string, number>;
	readonly unsettledQuantities: ReadonlyMap<string, number>;
}

export interface PixiTileMotionRuntime {
	/** Releases interruptible spawn or swap ownership at its live pose for direct interaction. */
	readonly beginInteractionHandoffFx: (actorId: string) => Effect.Effect<boolean>;
	readonly enqueueFx: (cues: ReadonlyArray<TileMotionCue>) => Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<PixiTileMotionSnapshot>;
	readonly startFx: Effect.Effect<void>;
	readonly syncQuantitiesFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
