import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { SourceActionSchema } from "~/engine/merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";
import { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { DropItemIgnoredReasonEnumSchema } from "./DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "./DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "./DropItemResultKindEnumSchema";

const DropItemMovedResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"Move",
		]),
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
		kind: DropItemResultKindEnumSchema.extract([
			"Swap",
		]),
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
		kind: DropItemResultKindEnumSchema.extract([
			"Merge",
		]),
		action: SourceActionSchema,
		effect: TargetEffectSchema,
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

const DropItemStoredActorStateSchema = z
	.object({
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		revision: RevisionSchema,
		location: GridLocationSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

const DropItemStoredInputResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"StoreInput",
		]),
		storedQuantity: PositiveIntegerSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		source: z
			.object({
				itemId: IdSchema,
				canonicalItemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemStoredActorStateSchema.nullable(),
			})
			.strict(),
		owner: z
			.object({
				itemId: IdSchema,
				revision: RevisionSchema,
				location: GridLocationSchema,
			})
			.strict(),
	})
	.strict();

const DropItemStoredInventoryResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"StoreInventory",
		]),
		source: z
			.object({
				itemId: IdSchema,
				canonicalItemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemStoredActorStateSchema.nullable(),
			})
			.strict(),
		inventory: z
			.object({
				itemId: IdSchema,
				revision: RevisionSchema,
				location: GridLocationSchema,
			})
			.strict(),
	})
	.strict();

const DropItemStackedResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"Stack",
		]),
		transferredQuantity: PositiveIntegerSchema,
		source: z
			.object({
				itemId: IdSchema,
				canonicalItemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemMergeActorStateSchema.nullable(),
			})
			.strict(),
		target: z
			.object({
				itemId: IdSchema,
				canonicalItemId: IdSchema,
				previousRevision: RevisionSchema,
				previousLocation: GridLocationSchema,
				previousQuantity: PositiveIntegerSchema,
				current: DropItemMergeActorStateSchema,
			})
			.strict(),
	})
	.strict();

const DropItemIgnoredResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"Ignored",
		]),
		reason: DropItemIgnoredReasonEnumSchema,
		itemId: IdSchema,
		location: GridLocationSchema,
	})
	.strict();

const DropItemRejectedResultSchema = z
	.object({
		kind: DropItemResultKindEnumSchema.extract([
			"Reject",
		]),
		reason: DropItemRejectedReasonEnumSchema,
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
		DropItemStoredInventoryResultSchema,
		DropItemStoredInputResultSchema,
		DropItemStackedResultSchema,
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
