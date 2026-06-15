import { z } from "zod";

export const CraftProgressPhaseSchema = z.enum([
	"collecting_inputs",
	"waiting",
	"ready",
]);

type CraftProgressPhaseSchema = typeof CraftProgressPhaseSchema;
export namespace CraftProgressPhaseSchema {
	export type Type = z.infer<CraftProgressPhaseSchema>;
}

export type CraftProgressPhase = CraftProgressPhaseSchema.Type;
