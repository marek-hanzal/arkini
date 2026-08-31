import type { Effect } from "effect";

export type MagneticSourceKind = "drag" | "motion";

export interface MagneticSample {
	readonly attractedActorId: string | null;
	/** Stable broad-phase candidates for this exact live source pose. */
	readonly candidateActorIds: ReadonlyArray<string>;
	readonly eligibleAttractionActorIds: ReadonlySet<string>;
	readonly sourceActorId: string;
	readonly sourceInstanceId: string;
	readonly sourceDirection: {
		readonly x: number;
		readonly y: number;
	} | null;
	readonly sourceKind?: MagneticSourceKind;
	readonly sourceSize?: number;
	readonly sourceX: number;
	readonly sourceY: number;
}

export interface MagneticField {
	/** Applies the current composed samples inside an already-owned scene frame. */
	readonly flushFx: Effect.Effect<void, never, never>;
	readonly pruneFx: Effect.Effect<void, never, never>;
	/** Exposes only the bounded live source set for lazy moving-receiver eligibility. */
	readonly readActiveSourceActorIdsFx: Effect.Effect<ReadonlyArray<string>, never, never>;
	readonly releaseFx: (source: {
		readonly sourceActorId: string;
		readonly sourceInstanceId: string;
		readonly sourceKind: MagneticSourceKind;
	}) => Effect.Effect<void, never, never>;
	readonly releaseSourcesFx: (
		sourceKind: MagneticSourceKind,
	) => Effect.Effect<void, never, never>;
	readonly resetFx: Effect.Effect<void, never, never>;
	readonly subscribeSourceMembershipFx: (
		listen: (sourceKind: MagneticSourceKind) => void,
	) => Effect.Effect<() => void, never, never>;
	readonly updateFx: (sample: MagneticSample) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
