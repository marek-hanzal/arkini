import { z } from "zod";

export const GamePlacementFailureReasonSchema = z.enum([
	"board:full",
	"board:max-count",
	"inventory:full",
	"placement-failed:unknown",
	"storage:inventory-forbidden",
	"effect:block-create",
]);

export type GamePlacementFailureReasonSchema = typeof GamePlacementFailureReasonSchema;

export namespace GamePlacementFailureReasonSchema {
	export type Type = z.infer<typeof GamePlacementFailureReasonSchema>;
}

export type GamePlacementFailureReason = GamePlacementFailureReasonSchema.Type;
