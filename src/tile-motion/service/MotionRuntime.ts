import type { Effect } from "effect";

import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";

/** Moving actors block pointer interaction until landing. */
export type InteractionClaim = "blocked";

export interface MotionSnapshot {
	readonly interactionClaimByActorId: ReadonlyMap<string, InteractionClaim>;
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
}

export interface MotionRuntime {
	/** Retires all presentation owned by a replaced space before its new cues are enqueued. */
	readonly cancelSpaceFx: (space: number) => Effect.Effect<void, never, never>;
	/** Retires spawn, input, and swap cues before canonical deliveries take their actors at the live pose. */
	readonly handoffDeliveriesFx: (
		actorIds: ReadonlySet<string>,
	) => Effect.Effect<void, never, never>;
	readonly enqueueFx: (cues: ReadonlyArray<TileMotionCue>) => Effect.Effect<void, never, never>;
	readonly readSnapshotFx: Effect.Effect<MotionSnapshot, never, never>;
	readonly startFx: Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
