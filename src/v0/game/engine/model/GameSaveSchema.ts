import { z } from "zod";
import { GameItemCreatedReasonSchema } from "~/v0/game/engine/model/GameEventSchema";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameSaveBoardItemSchema = z
	.object({
		id: IdSchema,
		itemId: IdSchema,
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

export const GameSaveInventoryStackSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

export const GameSaveInventorySlotSchema = z.union([
	GameSaveInventoryStackSchema,
	z.null(),
]);

export const GameSaveProducerJobSchema = z
	.object({
		id: IdSchema,
		producerItemInstanceId: IdSchema,
		productId: IdSchema,
		startedAtMs: NonNegativeIntegerSchema,
		completesAtMs: NonNegativeIntegerSchema,
	})
	.strict()
	.refine((value) => value.completesAtMs >= value.startedAtMs, {
		message: "completesAtMs must be >= startedAtMs",
		path: [
			"completesAtMs",
		],
	});

export const GameSaveCraftJobReturnItemSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

export const GameSaveCraftJobSchema = z
	.object({
		id: IdSchema,
		recipeId: IdSchema,
		startedAtMs: NonNegativeIntegerSchema,
		completesAtMs: NonNegativeIntegerSchema,
		returnItems: z.array(GameSaveCraftJobReturnItemSchema),
	})
	.strict()
	.refine((value) => value.completesAtMs >= value.startedAtMs, {
		message: "completesAtMs must be >= startedAtMs",
		path: [
			"completesAtMs",
		],
	});

export const GameSaveScheduledEventSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				id: IdSchema,
				type: z.literal("item.spawn"),
				dueAtMs: NonNegativeIntegerSchema,
				exclusiveKey: IdSchema.optional(),
				itemId: IdSchema,
				quantity: PositiveIntegerSchema,
				reason: GameItemCreatedReasonSchema,
				originItemInstanceId: IdSchema.optional(),
			})
			.strict(),
	])
	.refine((value) => !value.exclusiveKey || value.exclusiveKey !== value.id, {
		message: "exclusiveKey must group events and must not equal event id",
		path: [
			"exclusiveKey",
		],
	});

export const GameSaveSchema = z
	.object({
		version: z.literal(1),
		gameId: IdSchema,
		createdAtMs: NonNegativeIntegerSchema,
		updatedAtMs: NonNegativeIntegerSchema,
		nextItemInstanceIndex: PositiveIntegerSchema,
		nextJobIndex: PositiveIntegerSchema,
		nextScheduledEventIndex: PositiveIntegerSchema,
		board: z
			.object({
				items: z.record(IdSchema, GameSaveBoardItemSchema),
			})
			.strict(),
		inventory: z
			.object({
				slots: z.array(GameSaveInventorySlotSchema),
			})
			.strict(),
		producerJobs: z.record(IdSchema, GameSaveProducerJobSchema),
		craftJobs: z.record(IdSchema, GameSaveCraftJobSchema),
		scheduledEvents: z.record(IdSchema, GameSaveScheduledEventSchema),
	})
	.strict()
	.refine((value) => value.updatedAtMs >= value.createdAtMs, {
		message: "updatedAtMs must be >= createdAtMs",
		path: [
			"updatedAtMs",
		],
	});

export type GameSaveBoardItem = z.infer<typeof GameSaveBoardItemSchema>;
export type GameSaveInventoryStack = z.infer<typeof GameSaveInventoryStackSchema>;
export type GameSaveInventorySlot = z.infer<typeof GameSaveInventorySlotSchema>;
export type GameSaveProducerJob = z.infer<typeof GameSaveProducerJobSchema>;
export type GameSaveCraftJob = z.infer<typeof GameSaveCraftJobSchema>;
export type GameSaveScheduledEvent = z.infer<typeof GameSaveScheduledEventSchema>;
export type GameSave = z.infer<typeof GameSaveSchema>;
