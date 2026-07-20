import { z } from "zod";

/** Exhaustive visual roles rendered by one Motion tile actor. */
export const TileActorPhaseSchema = z.enum([
	"stable",
	"hovered",
	"targeted",
	"dragging",
	"settling",
	"impact",
	"exiting",
]);

export type TileActorPhaseSchema = typeof TileActorPhaseSchema;

export namespace TileActorPhaseSchema {
	export type Type = z.infer<TileActorPhaseSchema>;
}
