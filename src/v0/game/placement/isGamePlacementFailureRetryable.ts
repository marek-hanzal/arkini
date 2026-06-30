import type { GamePlacementFailureReason } from "~/v0/game/placement/GamePlacementFailureReasonSchema";

const retryablePlacementFailureReasons = new Set<GamePlacementFailureReason>([
	"board:full",
	"board:max-count",
	"inventory:full",
	"effect:missing-grant",
	"effect:block-create",
	"placement-failed:unknown",
]);

export const isGamePlacementFailureRetryable = (reason: GamePlacementFailureReason) =>
	retryablePlacementFailureReasons.has(reason);
