import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";

export const readTargetLimitBlocked = (limits: readonly ItemTargetLimit[]) =>
	limits.some((limit) => limit.remainingQuantity < limit.requiredQuantity);
