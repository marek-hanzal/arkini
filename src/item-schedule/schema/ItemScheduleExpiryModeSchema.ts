import { z } from "zod";

/** Selects graceful production settlement or forced atomic removal at Clock expiry. */
export const ItemScheduleExpiryModeSchema = z
	.enum([
		"loose-kill",
		"kill-switch",
	])
	.describe(
		"Loose-kill waits for accepted production to settle. Kill-switch cancels work and atomically removes the owner, returning reserved items before unused buffers and expiry outcome; anything that cannot be placed is lost and logged.",
	);
export type ItemScheduleExpiryModeSchema = typeof ItemScheduleExpiryModeSchema;
export namespace ItemScheduleExpiryModeSchema {
	export type Type = z.infer<ItemScheduleExpiryModeSchema>;
}
