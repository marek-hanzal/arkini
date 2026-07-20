import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { ActionEnumSchema } from "~/engine/merge/schema/ActionEnumSchema";
import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
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

const DropItemMergeActorStateSchema = z
	.object({
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		revision: RevisionSchema,
		location: GridLocationSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

const DropItemMergedResultSchema = z
	.object({
		kind: z.literal("merge"),
		action: ActionEnumSchema,
		effect: EffectEnumSchema,
		resultCanonicalItemId: IdSchema.optional(),
		source: z
			.object({
				itemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemMergeActorStateSchema.nullable(),
			})
			.strict(),
		target: z
			.object({
				itemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemMergeActorStateSchema.nullable(),
			})
			.strict(),
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
			"blocked",
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
		DropItemMergedResultSchema,
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
