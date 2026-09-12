import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Lifetime closes new intent, not previously admitted production. */
export const isItemProductionAdmissionOpenFn = (item: RuntimeItemSchema.Type): boolean =>
	item.schedule?.remainingDurationMs !== 0;
