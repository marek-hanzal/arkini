import { z } from "zod";

/** Why one attempted runtime-item drop was an accepted no-op. */
export const DropItemIgnoredReasonEnumSchema = z
	.enum({
		SameLocation: "same-location",
	})
	.meta({
		id: "DropItemIgnoredReasonEnumSchema",
		description: "Why one attempted runtime-item drop was an accepted no-op.",
	});

export type DropItemIgnoredReasonEnumSchema = typeof DropItemIgnoredReasonEnumSchema;

export namespace DropItemIgnoredReasonEnumSchema {
	export type Type = z.infer<DropItemIgnoredReasonEnumSchema>;
}
