import { z } from "zod";
import { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
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

const lineInputAutofillStartedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"LineInputAutofillStarted",
		]),
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
		lineId: IdSchema,
		scheduledQuantity: PositiveIntegerSchema,
	})
	.strict();

const jobQueuedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobQueued",
		]),
		requestId: IdSchema,
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict();

const jobQueueClearedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobQueueCleared",
		]),
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
		clearedRequestCount: PositiveIntegerSchema,
	})
	.strict();

const jobStartedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobStarted",
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
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
		canonicalItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict();

const jobAbortedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobAborted",
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
		lineId: IdSchema,
		reason: z.enum([
			"owner-removed",
			"material-expired",
			"player-cancelled",
		]),
	})
	.strict();

const itemDiscardedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemDiscarded",
		]),
		ownerItemId: IdSchema,
		canonicalItemId: IdSchema,
		itemId: IdSchema.optional(),
		quantity: PositiveIntegerSchema,
		source: z.enum([
			"consumed-input",
			"reservation",
			"buffer",
			"expiry-outcome",
			"depletion-outcome",
		]),
		reason: z.enum([
			"job-aborted",
			"board:full",
		]),
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
		location: BoardLocationSchema,
	})
	.strict();

const itemSwappedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemSwapped",
		]),
		sourceItemId: IdSchema,
		sourceCanonicalItemId: IdSchema,
		targetItemId: IdSchema,
		targetCanonicalItemId: IdSchema,
		sourceLocation: BoardLocationSchema,
		targetLocation: BoardLocationSchema,
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
			BoardLocationSchema,
		]),
		location: BoardLocationSchema,
	})
	.strict();

const itemConsumedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemConsumed",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		sourceLocation: InputLocationSchema,
	})
	.strict();

const itemInputStoredEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemInputStored",
		]),
		sourceItemId: IdSchema,
		canonicalItemId: IdSchema,
		previousSourceLocation: BoardLocationSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
	})
	.strict();

const itemUnitSpentEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemUnitSpent",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
		previousUnits: z.number().int().positive(),
		resultingUnits: z.number().int().positive(),
	})
	.strict()
	.refine((event) => event.resultingUnits < event.previousUnits, {
		message: "resultingUnits must be less than previousUnits",
	});

const itemDepletedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemDepleted",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: BoardLocationSchema,
	})
	.strict();

const itemDisappearedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemDisappeared",
		]),
		itemId: IdSchema,
		canonicalItemId: IdSchema,
		location: LocationSchema,
	})
	.strict();

const itemRemovedEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemRemoved",
		]),
		/** Exact terminal instance value captured by the removal operation, not the previous commit. */
		snapshot: RuntimeItemSchema,
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
	itemRemovedEventSchema,
	currentSpaceChangedEventSchema,
	jobQueuedEventSchema,
	lineInputAutofillStartedEventSchema,
	jobQueueClearedEventSchema,
	jobStartedEventSchema,
	jobCompletedEventSchema,
	jobAbortedEventSchema,
	itemDiscardedEventSchema,
	itemMergedEventSchema,
	itemExpiredEventSchema,
	itemSpawnedEventSchema,
	itemPlacedEventSchema,
	itemSwappedEventSchema,
	itemConsumedEventSchema,
	itemInputStoredEventSchema,
	itemUnitSpentEventSchema,
	itemDepletedEventSchema,
	itemDisappearedEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
