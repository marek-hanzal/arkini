import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";

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
	readonly targetFootprint: GridSizeSchema.Type;
}

export interface TileStackMotionCue extends TileMotionCueBase {
	readonly kind: "stack";
	readonly targetActorId: string;
	readonly canonicalItemId: string;
	readonly quantity: number;
	readonly originFootprint: GridSizeSchema.Type;
	readonly targetFootprint: GridSizeSchema.Type;
}

export interface TileInputMotionCue extends TileMotionCueBase {
	readonly kind: "input";
	readonly sourceItem?: TileActorItem;
	readonly sourceActorId: string;
	readonly targetActorId: string;
	readonly canonicalItemId: string;
	readonly previousQuantity: number;
	readonly storedQuantity: number;
	readonly resultingQuantity: number;
	readonly originFootprint: GridSizeSchema.Type;
	readonly targetFootprint: GridSizeSchema.Type;
}

export interface TileSwapMotionCue extends TileMotionCueBase {
	readonly kind: "swap";
	readonly actorId: string;
	readonly counterpartActorId: string;
	readonly originFootprint: GridSizeSchema.Type;
	readonly targetFootprint: GridSizeSchema.Type;
	readonly counterpartOriginFootprint: GridSizeSchema.Type;
	readonly counterpartTargetFootprint: GridSizeSchema.Type;
}

/** One identity relocation authored by an ordered committed drop result. */
export interface TileRelocationMotionCue extends TileMotionCueBase {
	readonly kind: "relocation";
	readonly actorId: string;
	readonly originFootprint: GridSizeSchema.Type;
	readonly targetFootprint: GridSizeSchema.Type;
}

/** One renderer-owned physical intent compiled from a complete committed transition. */
export type TileMotionCue =
	| TileSpawnMotionCue
	| TileStackMotionCue
	| TileInputMotionCue
	| TileSwapMotionCue
	| TileRelocationMotionCue;
