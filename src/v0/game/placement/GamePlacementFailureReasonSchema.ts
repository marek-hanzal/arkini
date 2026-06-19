import { z } from "zod";

export const GamePlacementFailureReasonSchema = z.enum([
	"board:full",
	"inventory:full",
	"placement-failed:unknown",
]);

export type GamePlacementFailureReasonSchema = typeof GamePlacementFailureReasonSchema;

export namespace GamePlacementFailureReasonSchema {
	export type Type = z.infer<typeof GamePlacementFailureReasonSchema>;
}

export type GamePlacementFailureReason = GamePlacementFailureReasonSchema.Type;
