import { z } from "zod";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";
import { GamePlacementFailureReasonSchema } from "~/placement/GamePlacementFailureReasonSchema";
import {
	GameBoardItemChangeReasonSchema,
	GameEventItemConsumedSourceSchema,
	GameEventPlacementTargetSchema,
	GameItemConsumedReasonSchema,
	GameItemCreatedReasonSchema,
	IdSchema,
} from "~/event/GameEventBaseSchemas";

export const GameItemCreatedEventSchema = z
	.object({
		type: z.literal("item.created"),
		itemId: IdSchema,
		originItemInstanceId: IdSchema.optional(),
		reason: GameItemCreatedReasonSchema,
		spawnJobId: IdSchema.optional(),
		spawnSequenceIndex: z.number().int().min(0).optional(),
		to: GameEventPlacementTargetSchema,
	})
	.strict();

export const GameItemConsumedEventSchema = z
	.object({
		type: z.literal("item.consumed"),
		itemId: IdSchema,
		reason: GameItemConsumedReasonSchema,
		from: GameEventItemConsumedSourceSchema,
	})
	.strict();

export const GameItemRemovedEventSchema = z
	.object({
		type: z.literal("item.removed"),
		itemId: IdSchema,
		itemInstanceId: IdSchema,
		reason: GameBoardItemChangeReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameItemReplacedEventSchema = z
	.object({
		type: z.literal("item.replaced"),
		fromItemId: IdSchema,
		itemInstanceId: IdSchema,
		reason: GameBoardItemChangeReasonSchema,
		atMs: GameInstantMsSchema,
		toItemId: IdSchema,
	})
	.strict();

export const GameItemCapacityChangedEventSchema = z
	.object({
		type: z.literal("item.capacity.changed"),
		itemId: IdSchema,
		itemInstanceId: IdSchema,
		amount: z.number().int().positive(),
		max: z.number().int().positive(),
		previousRemaining: z.number().int().min(0),
		nextRemaining: z.number().int().min(0),
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameItemCapacityDepletedEventSchema = z
	.object({
		type: z.literal("item.capacity.depleted"),
		itemId: IdSchema,
		itemInstanceId: IdSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameItemSpawnBlockedEventSchema = z
	.object({
		type: z.literal("item.spawn.blocked"),
		jobId: IdSchema,
		itemId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameItemSpawnFailedEventSchema = z
	.object({
		type: z.literal("item.spawn.failed"),
		jobId: IdSchema,
		itemId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();
