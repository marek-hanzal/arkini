import { z } from "zod";
import {
	IdSchema,
	NonNegativeIntegerSchema,
	PositiveIntegerSchema,
} from "~/event/GameEventBaseSchemas";
import { GamePlacementFailureReasonSchema } from "~/placement/GamePlacementFailureReasonSchema";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

export const GameCraftInputStoredEventSchema = z
	.object({
		type: z.literal("craft_input.stored"),
		targetItemInstanceId: IdSchema,
		recipeId: IdSchema,
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		previousQuantity: NonNegativeIntegerSchema,
		nextQuantity: PositiveIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameCraftInputWithdrawnEventSchema = z
	.object({
		type: z.literal("craft_input.withdrawn"),
		targetItemInstanceId: IdSchema,
		recipeId: IdSchema,
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		previousQuantity: PositiveIntegerSchema,
		nextQuantity: NonNegativeIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameCraftStartedEventSchema = z
	.object({
		type: z.literal("craft.started"),
		atMs: GameInstantMsSchema,
		jobId: IdSchema,
		recipeId: IdSchema,
		targetItemInstanceId: IdSchema,
		startAtMs: GameInstantMsSchema,
		readyAtMs: GameInstantMsSchema,
	})
	.strict();

export const GameCraftCompletedEventSchema = z
	.object({
		type: z.literal("craft.completed"),
		jobId: IdSchema,
		recipeId: IdSchema,
		targetItemInstanceId: IdSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameCraftBlockedEventSchema = z
	.object({
		type: z.literal("craft.blocked"),
		jobId: IdSchema,
		recipeId: IdSchema,
		targetItemInstanceId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameCraftFailedEventSchema = z
	.object({
		type: z.literal("craft.failed"),
		jobId: IdSchema,
		recipeId: IdSchema,
		targetItemInstanceId: IdSchema,
		reason: GamePlacementFailureReasonSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();
