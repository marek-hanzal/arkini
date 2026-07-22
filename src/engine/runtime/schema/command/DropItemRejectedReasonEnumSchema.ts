import { z } from "zod";

/** Why one attempted runtime-item drop was rejected. */
export const DropItemRejectedReasonEnumSchema = z
	.enum({
		UnsupportedTarget: "unsupported-target",
		Occupied: "occupied",
		Blocked: "blocked",
		StaleSource: "stale-source",
		StaleTarget: "stale-target",
		InvalidSource: "invalid-source",
		InvalidTarget: "invalid-target",
	})
	.meta({
		id: "DropItemRejectedReasonEnumSchema",
		description: "Why one attempted runtime-item drop was rejected.",
	});

export type DropItemRejectedReasonEnumSchema = typeof DropItemRejectedReasonEnumSchema;

export namespace DropItemRejectedReasonEnumSchema {
	export type Type = z.infer<DropItemRejectedReasonEnumSchema>;
}
