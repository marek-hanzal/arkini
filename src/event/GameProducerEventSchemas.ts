import { z } from "zod";
import {
	IdSchema,
	NonNegativeIntegerSchema,
	PositiveIntegerSchema,
} from "~/event/GameEventBaseSchemas";
import { GamePlacementFailureReasonSchema } from "~/placement/GamePlacementFailureReasonSchema";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

export const GameProducerInputStoredEventSchema = z
	.object({
		type: z.literal("producer_input.stored"),
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		previousQuantity: NonNegativeIntegerSchema,
		nextQuantity: PositiveIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameProducerInputWithdrawnEventSchema = z
	.object({
		type: z.literal("producer_input.withdrawn"),
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		previousQuantity: PositiveIntegerSchema,
		nextQuantity: NonNegativeIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameLineStartedEventSchema = z
	.object({
		type: z.literal("line.started"),
		atMs: GameInstantMsSchema,
		jobId: IdSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		startAtMs: GameInstantMsSchema,
		readyAtMs: GameInstantMsSchema,
	})
	.strict();

export const GameLineCompletedEventSchema = z
	.object({
		type: z.literal("line.completed"),
		jobId: IdSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameLineBlockedEventSchema = z
	.object({
		type: z.literal("line.blocked"),
		jobId: IdSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameLineFailedEventSchema = z
	.object({
		type: z.literal("line.failed"),
		jobId: IdSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameLineDefaultChangedEventSchema = z
	.object({
		type: z.literal("line.default_changed"),
		itemInstanceId: IdSchema,
		previousLineId: IdSchema.optional(),
		nextLineId: IdSchema.optional(),
		atMs: GameInstantMsSchema,
	})
	.strict();
