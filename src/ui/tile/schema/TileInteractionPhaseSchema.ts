import { z } from "zod";

/** Valid top-level phases of the one Canvas-local pointer interaction. */
export const TileInteractionPhaseSchema = z.enum([
	"pressed",
	"dragging",
	"awaiting-outcome",
]);

export type TileInteractionPhaseSchema = typeof TileInteractionPhaseSchema;

export namespace TileInteractionPhaseSchema {
	export type Type = z.infer<TileInteractionPhaseSchema>;
}
