import { z } from "zod";
import { GameConfigSchema } from "~/v0/game/config/GameConfigSchema";
import { GameSaveUpgradeJobSchema } from "~/v0/game/engine/model/GameSaveUpgradeJobSchema";
import { GameSaveUpgradeStateSchema } from "~/v0/game/engine/model/GameSaveUpgradeStateSchema";
import { GameItemCreatedReasonSchema } from "~/v0/game/engine/model/GameEventSchema";
import { validateGameSaveAgainstConfig } from "~/v0/game/engine/model/GameSaveValidation";

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

export const GameSaveInventoryInstanceSchema = z
	.object({
		id: IdSchema,
		itemId: IdSchema,
		kind: z.literal("instance"),
	})
	.strict();

export const GameSaveInventorySlotSchema = z.union([
	GameSaveInventoryStackSchema,
	GameSaveInventoryInstanceSchema,
	z.null(),
]);

export const GameSaveProducerDeliveryItemSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

export const GameSaveProducerDeliverySchema = z
	.object({
		items: z.array(GameSaveProducerDeliveryItemSchema).min(1),
		lastBlockedAtMs: NonNegativeIntegerSchema.optional(),
		retryAtMs: NonNegativeIntegerSchema.optional(),
	})
	.strict();

export const GameSaveProducerJobSchema = z
	.object({
		id: IdSchema,
		delivery: GameSaveProducerDeliverySchema.optional(),
		producerItemInstanceId: IdSchema,
		outputTableId: z.union([
			IdSchema,
			z.null(),
		]),
		placement: z.literal("board_then_inventory").optional(),
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

export const GameSaveCraftJobSchema = z
	.object({
		id: IdSchema,
		recipeId: IdSchema,
		startedAtMs: NonNegativeIntegerSchema,
		completesAtMs: NonNegativeIntegerSchema,
		targetItemInstanceId: IdSchema,
	})
	.strict()
	.refine((value) => value.completesAtMs >= value.startedAtMs, {
		message: "completesAtMs must be >= startedAtMs",
		path: [
			"completesAtMs",
		],
	});

export const GameSaveStashStateSchema = z
	.object({
		remainingCharges: NonNegativeIntegerSchema,
	})
	.strict();

export const GameSaveProducerLineStateSchema = z
	.object({
		disabledProductIds: z.array(IdSchema),
	})
	.strict()
	.refine((value) => new Set(value.disabledProductIds).size === value.disabledProductIds.length, {
		message: "disabledProductIds must be unique",
		path: [
			"disabledProductIds",
		],
	});

export const GameSaveProducerProductInputStateSchema = z
	.object({
		items: z.record(IdSchema, PositiveIntegerSchema),
	})
	.strict();

export const GameSaveProducerInputStateSchema = z
	.object({
		productInputs: z.record(IdSchema, GameSaveProducerProductInputStateSchema),
	})
	.strict();

export const GameSaveCraftInputStateSchema = z
	.object({
		items: z.record(IdSchema, PositiveIntegerSchema),
	})
	.strict();

export const GameSaveStoredRequirementStateSchema = z
	.object({
		items: z.record(IdSchema, PositiveIntegerSchema),
	})
	.strict();

export const GameSaveScheduledEventBaseSchema = z
	.object({
		id: IdSchema,
		dueAtMs: NonNegativeIntegerSchema,
		exclusiveKey: IdSchema.optional(),
		afterEventIds: z.array(IdSchema).optional(),
		lastBlockedAtMs: NonNegativeIntegerSchema.optional(),
	})
	.strict()
	.refine(
		(value) =>
			!value.afterEventIds ||
			new Set(value.afterEventIds).size === value.afterEventIds.length,
		{
			message: "afterEventIds must be unique",
			path: [
				"afterEventIds",
			],
		},
	);

export const GameSaveScheduledEventSchema = GameSaveScheduledEventBaseSchema.extend({
	itemId: IdSchema,
	originItemInstanceId: IdSchema.optional(),
	quantity: PositiveIntegerSchema,
	reason: GameItemCreatedReasonSchema,
	type: z.literal("item.spawn"),
})
	.strict()
	.refine((value) => !value.exclusiveKey || value.exclusiveKey !== value.id, {
		message: "exclusiveKey must group events and must not equal event id",
		path: [
			"exclusiveKey",
		],
	})
	.refine((value) => !value.afterEventIds?.includes(value.id), {
		message: "afterEventIds must not contain event id",
		path: [
			"afterEventIds",
		],
	});

export const GameSaveSchema = z
	.object({
		version: z.literal(1),
		gameId: IdSchema,
		createdAtMs: NonNegativeIntegerSchema,
		updatedAtMs: NonNegativeIntegerSchema,
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
		producerLines: z.record(IdSchema, GameSaveProducerLineStateSchema),
		producerInputs: z.record(IdSchema, GameSaveProducerInputStateSchema),
		craftJobs: z.record(IdSchema, GameSaveCraftJobSchema),
		craftInputs: z.record(IdSchema, GameSaveCraftInputStateSchema),
		upgradeJobs: z.record(IdSchema, GameSaveUpgradeJobSchema),
		upgrades: z.record(IdSchema, GameSaveUpgradeStateSchema),
		stashes: z.record(IdSchema, GameSaveStashStateSchema),
		storedRequirements: z.record(IdSchema, GameSaveStoredRequirementStateSchema),
		scheduledEvents: z.record(IdSchema, GameSaveScheduledEventSchema),
	})
	.strict()
	.refine((value) => value.updatedAtMs >= value.createdAtMs, {
		message: "updatedAtMs must be >= createdAtMs",
		path: [
			"updatedAtMs",
		],
	});

export const GameSaveConfigSchema = z
	.object({
		config: GameConfigSchema,
		save: GameSaveSchema,
	})
	.strict()
	.superRefine(({ config, save }, ctx) => {
		validateGameSaveAgainstConfig(ctx, save, config);
	});

export type GameSaveBoardItem = z.infer<typeof GameSaveBoardItemSchema>;
export type GameSaveInventoryStack = z.infer<typeof GameSaveInventoryStackSchema>;
export type GameSaveInventoryInstance = z.infer<typeof GameSaveInventoryInstanceSchema>;
export type GameSaveInventorySlot = z.infer<typeof GameSaveInventorySlotSchema>;
export type GameSaveProducerDeliveryItem = z.infer<typeof GameSaveProducerDeliveryItemSchema>;
export type GameSaveProducerDelivery = z.infer<typeof GameSaveProducerDeliverySchema>;
export type GameSaveProducerJob = z.infer<typeof GameSaveProducerJobSchema>;
export type GameSaveProducerLineState = z.infer<typeof GameSaveProducerLineStateSchema>;
export type GameSaveProducerProductInputState = z.infer<
	typeof GameSaveProducerProductInputStateSchema
>;
export type GameSaveProducerInputState = z.infer<typeof GameSaveProducerInputStateSchema>;
export type GameSaveCraftInputState = z.infer<typeof GameSaveCraftInputStateSchema>;
export type GameSaveCraftJob = z.infer<typeof GameSaveCraftJobSchema>;
export type GameSaveStashState = z.infer<typeof GameSaveStashStateSchema>;
export type GameSaveStoredRequirementState = z.infer<typeof GameSaveStoredRequirementStateSchema>;
export type GameSaveUpgradeJob = z.infer<typeof GameSaveUpgradeJobSchema>;
export type GameSaveUpgradeState = z.infer<typeof GameSaveUpgradeStateSchema>;
export type GameSaveScheduledEvent = z.infer<typeof GameSaveScheduledEventSchema>;
export type GameSave = z.infer<typeof GameSaveSchema>;
export type GameSaveConfig = z.infer<typeof GameSaveConfigSchema>;
