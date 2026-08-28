import type { Effect } from "effect";

export type PixiTileMagneticSourceKind = "drag" | "motion";

export interface PixiTileMagneticFieldSample {
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
	readonly sourceKind?: PixiTileMagneticSourceKind;
	readonly sourceSize?: number;
	readonly sourceX: number;
	readonly sourceY: number;
}

export interface PixiTileMagneticField {
	/** Applies the current composed samples inside an already-owned scene frame. */
	readonly flushFx: Effect.Effect<void>;
	readonly pruneFx: Effect.Effect<void>;
	/** Exposes only the bounded live source set for lazy moving-receiver eligibility. */
	readonly readActiveSourceActorIdsFx: Effect.Effect<ReadonlyArray<string>>;
	readonly releaseFx: (source: {
		readonly sourceActorId: string;
		readonly sourceInstanceId: string;
		readonly sourceKind: PixiTileMagneticSourceKind;
	}) => Effect.Effect<void>;
	readonly releaseSourcesFx: (sourceKind: PixiTileMagneticSourceKind) => Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
	readonly subscribeSourceMembershipFx: (
		listen: (sourceKind: PixiTileMagneticSourceKind) => void,
	) => Effect.Effect<() => void>;
	readonly updateFx: (sample: PixiTileMagneticFieldSample) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
