import type { Effect } from "effect";

import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { QuantityPresentation } from "~/tile-motion/type/QuantityPresentation";
import type { MotionRedirect } from "~/tile-motion/type/MotionTarget";

/** Presentation ownership of dragging; ordinary click activation always remains available. */
export type InteractionClaim = "activation-only" | "handoff";

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
	readonly quantityPresentationByActorId: ReadonlyMap<string, QuantityPresentation>;
}

export interface MotionRuntime {
	/** Retires spawn and input cues before canonical deliveries take their actors at the live pose. */
	readonly handoffDeliveriesFx: (
		actorIds: ReadonlySet<string>,
	) => Effect.Effect<void, never, never>;
	/** Releases interruptible spawn or swap ownership at its live pose for direct interaction. */
	readonly beginInteractionHandoffFx: (actorId: string) => Effect.Effect<boolean, never, never>;
	readonly enqueueFx: (cues: ReadonlyArray<TileMotionCue>) => Effect.Effect<void, never, never>;
	/** Transfers trailing presentation payloads when their original receiver is consumed. */
	readonly redirectTargetFx: (redirect: MotionRedirect) => Effect.Effect<void, never, never>;
	readonly readSnapshotFx: Effect.Effect<MotionSnapshot, never, never>;
	readonly startFx: Effect.Effect<void, never, never>;
	readonly syncPresentationFx: Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
