import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

interface TileMotionCueBase {
	readonly sequence: number;
	readonly eventIndex: number;
	readonly staggerIndex: number;
	readonly originActorId: string;
	readonly originLocation: GridLocationSchema.Type;
	readonly targetLocation: GridLocationSchema.Type;
}

export interface TileSpawnMotionCue extends TileMotionCueBase {
	readonly kind: "spawn";
	readonly actorId: string;
}

export interface TileStackMotionCue extends TileMotionCueBase {
	readonly kind: "stack";
	readonly targetActorId: string;
	readonly canonicalItemId: string;
	readonly quantity: number;
}

export interface TileSwapMotionCue extends TileMotionCueBase {
	readonly kind: "swap";
	readonly actorId: string;
	readonly counterpartActorId: string;
}

/** One renderer-owned physical intent compiled from a complete committed transition. */
export type TileMotionCue = TileSpawnMotionCue | TileStackMotionCue | TileSwapMotionCue;
