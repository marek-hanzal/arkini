import type { Effect } from "effect";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import type { QuantityPresentation } from "~/ui/pixi/motion/QuantityPresentation";
import type { MotionRedirect } from "~/ui/pixi/motion/MotionTarget";

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
	/** Releases interruptible spawn or swap ownership at its live pose for direct interaction. */
	readonly beginInteractionHandoffFx: (actorId: string) => Effect.Effect<boolean>;
	readonly enqueueFx: (cues: ReadonlyArray<TileMotionCue>) => Effect.Effect<void>;
	/** Transfers trailing presentation payloads when their original receiver is consumed. */
	readonly redirectTargetFx: (redirect: MotionRedirect) => Effect.Effect<void>;
	readonly readSnapshotFx: Effect.Effect<MotionSnapshot>;
	readonly startFx: Effect.Effect<void>;
	readonly syncPresentationFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
