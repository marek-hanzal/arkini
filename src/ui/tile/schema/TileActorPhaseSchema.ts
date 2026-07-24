import { z } from "zod";

/** Exhaustive immediate interaction roles rendered by one tile actor. */
export const TileActorPhaseSchema = z.enum([
	"stable",
	"hovered",
	"targeted",
	"dragging",
]);

export type TileActorPhaseSchema = typeof TileActorPhaseSchema;

export namespace TileActorPhaseSchema {
	export type Type = z.infer<TileActorPhaseSchema>;
}
