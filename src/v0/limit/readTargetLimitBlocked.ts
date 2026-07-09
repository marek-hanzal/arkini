import type { ItemTargetLimit } from "~/limit/ItemTargetLimit";

export const readTargetLimitBlocked = (limits: readonly ItemTargetLimit[]) =>
	limits.some((limit) => limit.remainingQuantity < limit.requiredQuantity);
