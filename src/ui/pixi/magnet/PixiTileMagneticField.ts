import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export type PixiTileMagneticSourceKind = "drag" | "motion";

export interface PixiTileMagneticFieldSample {
	readonly attractedActorId: string | null;
	readonly eligibleAttractionActorIds: ReadonlySet<string>;
	readonly sourceActorId: string;
	readonly sourceDirection: {
		readonly x: number;
		readonly y: number;
	} | null;
	readonly sourceItem: TileActorItem;
	readonly sourceKind?: PixiTileMagneticSourceKind;
	readonly sourceSize?: number;
	readonly sourceX: number;
	readonly sourceY: number;
}

export interface PixiTileMagneticField {
	readonly pruneFx: Effect.Effect<void>;
	readonly releaseFx: (source: {
		readonly sourceActorId: string;
		readonly sourceKind: PixiTileMagneticSourceKind;
	}) => Effect.Effect<void>;
	readonly releaseSourcesFx: (sourceKind: PixiTileMagneticSourceKind) => Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
	readonly updateFx: (sample: PixiTileMagneticFieldSample) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
