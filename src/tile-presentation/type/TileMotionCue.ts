import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

interface TileMotionCueBase {
	readonly sequence: number;
	readonly eventIndex: number;
	readonly staggerIndex: number;
	readonly originActorId: string;
	readonly originLocation: BoardLocationSchema.Type;
	readonly targetLocation: BoardLocationSchema.Type;
}

export interface TileSpawnMotionCue extends TileMotionCueBase {
	readonly kind: "spawn";
	readonly actorId: string;
}

export interface TileInputMotionCue extends TileMotionCueBase {
	readonly kind: "input";
	readonly sourceActorId: string;
	readonly targetActorId: string;
	readonly itemUid: string;
}

export interface TileSwapMotionCue extends TileMotionCueBase {
	readonly kind: "swap";
	readonly actorId: string;
	readonly counterpartActorId: string;
}

/** One renderer-owned physical intent compiled from a complete committed transition. */
export type TileMotionCue = TileSpawnMotionCue | TileInputMotionCue | TileSwapMotionCue;
