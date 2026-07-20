import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

const DropItemMovedResultSchema = z
	.object({
		kind: z.literal("move"),
		itemId: IdSchema,
		revision: RevisionSchema,
		previousLocation: GridLocationSchema,
		location: GridLocationSchema,
	})
	.strict();

const DropItemSwappedActorSchema = z
	.object({
		itemId: IdSchema,
		revision: RevisionSchema,
		previousLocation: GridLocationSchema,
		location: GridLocationSchema,
	})
	.strict();

const DropItemSwappedResultSchema = z
	.object({
		kind: z.literal("swap"),
		source: DropItemSwappedActorSchema,
		target: DropItemSwappedActorSchema,
	})
	.strict();

const DropItemIgnoredResultSchema = z
	.object({
		kind: z.literal("ignored"),
		reason: z.literal("same-location"),
		itemId: IdSchema,
		location: GridLocationSchema,
	})
	.strict();

const DropItemRejectedResultSchema = z
	.object({
		kind: z.literal("reject"),
		reason: z.enum([
			"unsupported-target",
			"occupied",
			"stale-source",
			"stale-target",
			"invalid-source",
			"invalid-target",
		]),
		itemId: IdSchema,
		targetItemId: IdSchema.optional(),
	})
	.strict();

/** Explicit engine-owned presentation outcome for one attempted item drop. */
export const DropItemResultSchema = z
	.discriminatedUnion("kind", [
		DropItemMovedResultSchema,
		DropItemSwappedResultSchema,
		DropItemIgnoredResultSchema,
		DropItemRejectedResultSchema,
	])
	.meta({
		id: "DropItemResultSchema",
		description: "One explicit engine-owned item drop presentation outcome.",
	});

export type DropItemResultSchema = typeof DropItemResultSchema;

export namespace DropItemResultSchema {
	export type Type = z.infer<DropItemResultSchema>;
}
