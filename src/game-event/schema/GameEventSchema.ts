import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
import { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { LocationSchema } from "~/item-location/schema/LocationSchema";
import { ReservedLocationSchema } from "~/item-location/schema/ReservedLocationSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

const currentSpaceChangedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"CurrentSpaceChanged",
		]),
		previousSpace: NonNegativeIntegerSchema,
		currentSpace: NonNegativeIntegerSchema,
	})
	.strict();

const jobStartedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobStarted",
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict();

const jobCompletedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobCompleted",
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict();

const itemMergedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemMerged",
		]),
		sourceItemId: IdSchema,
		sourceCanonicalItemId: IdSchema,
		targetItemId: IdSchema,
		targetCanonicalItemId: IdSchema,
		action: SourceActionSchema,
		effect: TargetEffectSchema,
		resultCanonicalItemId: IdSchema.optional(),
	})
	.strict();

const itemExpiredEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemExpired",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict();

const itemSpawnedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemSpawned",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		originItemId: IdSchema,
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict();

const itemPlacedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemPlaced",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		originItemId: IdSchema,
		previousLocation: z.union([
			InputLocationSchema,
			ReservedLocationSchema,
			InventoryLocationSchema,
		]),
		location: GridLocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict();

const itemStackedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemStacked",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		originItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		quantity: z.number().int().positive(),
	})
	.strict()
	.refine((event) => event.quantity > event.previousQuantity, {
		message: "quantity must be greater than previousQuantity",
	});

const itemSplitEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemSplit",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().min(2),
		quantity: PositiveIntegerSchema,
	})
	.strict()
	.superRefine((event, context) => {
		if (event.quantity >= event.previousQuantity) {
			context.addIssue({
				code: "custom",
				message: "Split identity must retain less than its previous quantity.",
				path: [
					"quantity",
				],
			});
		}
	});

const itemConsumedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemConsumed",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		sourceLocation: InputLocationSchema,
		previousQuantity: z.number().int().positive(),
		consumedQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
	})
	.strict();

const itemInputStoredEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemInputStored",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		previousSourceLocation: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		storedQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
	})
	.strict();

const itemChargeSpentEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemChargeSpent",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousCharges: z.number().int().positive(),
		resultingCharges: z.number().int().positive(),
	})
	.strict()
	.refine((event) => event.resultingCharges < event.previousCharges, {
		message: "resultingCharges must be less than previousCharges",
	});

const itemDepletedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemDepleted",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: GridLocationSchema,
		previousQuantity: z.number().int().positive(),
		resultingQuantity: z.number().int().nonnegative(),
	})
	.strict();

const itemExplicitlyRemovedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemExplicitlyRemoved",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: LocationSchema,
		quantity: z.number().int().positive(),
	})
	.strict();

/**
 * Exact semantic facts emitted by successful engine commits.
 *
 * This union deliberately excludes animation, timing, and renderer intent.
 * Presentation may derive cues from committed facts, but engine commands must
 * never encode choreography into the authoritative event vocabulary.
 */
export const GameEventSchema = z.discriminatedUnion("type", [
	currentSpaceChangedEventSchema,
	jobStartedEventSchema,
	jobCompletedEventSchema,
	itemMergedEventSchema,
	itemExpiredEventSchema,
	itemSpawnedEventSchema,
	itemPlacedEventSchema,
	itemStackedEventSchema,
	itemSplitEventSchema,
	itemConsumedEventSchema,
	itemInputStoredEventSchema,
	itemChargeSpentEventSchema,
	itemDepletedEventSchema,
	itemExplicitlyRemovedEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
