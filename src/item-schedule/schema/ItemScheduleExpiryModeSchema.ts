import { z } from "zod";

/** Selects graceful settlement or forced overflow discard at Clock expiry. */
export const ItemScheduleExpiryModeSchema = z
	.enum([
		"loose-kill",
		"kill-switch",
	])
	.describe(
		"Loose-kill waits for accepted work and retries blocked expiry placement. Kill-switch cancels earlier work and discards expiry output or returned material that cannot be placed. A Board owner runs its selected expiry line as a Job; an internally held item settles its selected outcome immediately.",
	);
export type ItemScheduleExpiryModeSchema = typeof ItemScheduleExpiryModeSchema;
export namespace ItemScheduleExpiryModeSchema {
	export type Type = z.infer<ItemScheduleExpiryModeSchema>;
}
