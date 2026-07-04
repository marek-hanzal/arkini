import { z } from "zod";

export const GamePlacementFailureReasonSchema = z.enum([
	"board:full",
	"board:max-count",
	"inventory:full",
	"placement-failed:unknown",
	"storage:inventory-forbidden",
	"effect:missing-grant",
	"effect:block-create",
]);

export namespace GamePlacementFailureReasonSchema {
	export type Type = z.infer<typeof GamePlacementFailureReasonSchema>;
}

export type GamePlacementFailureReason = GamePlacementFailureReasonSchema.Type;
