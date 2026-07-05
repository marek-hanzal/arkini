import { z } from "zod";
import { GameItemCreatedReasonSchema } from "~/event/GameEventSchema";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeNumberSchema = z.number().min(0);

const GameSaveBoardItemSchema = z
	.object({
		createdAtMs: GameInstantMsSchema.optional(),
		id: IdSchema,
		itemId: IdSchema,
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

const GameSaveInventoryStackSchema = z
	.object({
		createdAtMs: GameInstantMsSchema.optional(),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

const GameSaveInventoryInstanceSchema = z
	.object({
		createdAtMs: GameInstantMsSchema.optional(),
		id: IdSchema,
		itemId: IdSchema,
		kind: z.literal("instance"),
	})
	.strict();

const GameSaveInventorySlotSchema = z.union([
	GameSaveInventoryStackSchema,
	GameSaveInventoryInstanceSchema,
	z.null(),
]);

const GameSaveDeliveryRetrySchema = z
	.object({
		lastBlockedAtMs: GameInstantMsSchema,
		nextAttemptAtMs: GameInstantMsSchema,
	})
	.strict()
	.refine((value) => value.nextAttemptAtMs >= value.lastBlockedAtMs, {
		message: "nextAttemptAtMs must be >= lastBlockedAtMs",
		path: [
			"nextAttemptAtMs",
		],
	});

const validateGameSavePausableJobTiming = (
	value: {
		pausedAtMs?: number;
		readyAtMs: number;
		remainingMs?: number;
		startAtMs: number;
	},
	ctx: z.RefinementCtx,
) => {
	if (value.readyAtMs < value.startAtMs) {
		ctx.addIssue({
			code: "custom",
			message: "readyAtMs must be >= startAtMs",
			path: [
				"readyAtMs",
			],
		});
	}

	if ((value.pausedAtMs === undefined) !== (value.remainingMs === undefined)) {
		ctx.addIssue({
			code: "custom",
			message: "pausedAtMs and remainingMs must be set together",
			path: [
				"pausedAtMs",
			],
		});
	}

	if (value.pausedAtMs !== undefined && value.pausedAtMs < value.startAtMs) {
		ctx.addIssue({
			code: "custom",
			message: "pausedAtMs must be >= startAtMs",
			path: [
				"pausedAtMs",
			],
		});
	}
};

const GameSaveProducerJobSchema = z
	.object({
		id: IdSchema,
		delivery: GameSaveDeliveryRetrySchema.optional(),
		pausedAtMs: GameInstantMsSchema.optional(),
		remainingMs: NonNegativeIntegerSchema.optional(),
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		startAtMs: GameInstantMsSchema,
		readyAtMs: GameInstantMsSchema,
	})
	.strict()
	.superRefine((value, ctx) => {
		validateGameSavePausableJobTiming(value, ctx);

		if (!value.delivery || value.pausedAtMs === undefined) return;

		ctx.addIssue({
			code: "custom",
			message: "delivery producer jobs must not be paused",
			path: [
				"delivery",
			],
		});
	});

const GameSaveActiveEffectSchema = z
	.object({
		id: IdSchema,
		effectId: IdSchema,
		sourceItemInstanceId: IdSchema,
		startAtMs: GameInstantMsSchema,
		endAtMs: GameInstantMsSchema,
		producerJobId: IdSchema.optional(),
	})
	.strict()
	.refine((value) => value.endAtMs >= value.startAtMs, {
		message: "endAtMs must be >= startAtMs",
		path: [
			"endAtMs",
		],
	});

const GameSaveCraftJobSchema = z
	.object({
		id: IdSchema,
		delivery: GameSaveDeliveryRetrySchema.optional(),
		pausedAtMs: GameInstantMsSchema.optional(),
		remainingMs: NonNegativeIntegerSchema.optional(),
		recipeId: IdSchema,
		startAtMs: GameInstantMsSchema,
		readyAtMs: GameInstantMsSchema,
		targetItemInstanceId: IdSchema,
	})
	.strict()
	.superRefine((value, ctx) => {
		validateGameSavePausableJobTiming(value, ctx);

		if (!value.delivery || value.pausedAtMs === undefined) return;

		ctx.addIssue({
			code: "custom",
			message: "delivery craft jobs must not be paused",
			path: [
				"delivery",
			],
		});
	});

const GameSaveProducerChargeStateSchema = z
	.object({
		remainingCharges: NonNegativeNumberSchema,
	})
	.strict();

const GameSaveItemCapacityStateSchema = z
	.object({
		remaining: NonNegativeIntegerSchema,
	})
	.strict();

const GameSaveBoardMemoryLayoutItemSchema = z
	.object({
		itemId: IdSchema,
		itemInstanceId: IdSchema.optional(),
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

const GameSaveBoardMemoryLayoutSchema = z
	.object({
		items: z.array(GameSaveBoardMemoryLayoutItemSchema),
		savedAtMs: GameInstantMsSchema,
	})
	.strict();

const GameSaveCheatStateSchema = z
	.object({
		speedMode: z
			.enum([
				"normal",
				"instant",
			])
			.default("normal"),
	})
	.strict();

const GameSaveLineStateSchema = z
	.object({
		defaultLineId: IdSchema.optional(),
		defaultEffectLineId: IdSchema.optional(),
	})
	.strict();

const GameSaveLineInputStateSchema = z
	.object({
		items: z.record(IdSchema, PositiveIntegerSchema),
	})
	.strict();

const GameSaveProducerInputStateSchema = z
	.object({
		lineInputs: z.record(IdSchema, GameSaveLineInputStateSchema),
	})
	.strict();

const GameSaveCraftInputStateSchema = z
	.object({
		items: z.record(IdSchema, PositiveIntegerSchema),
	})
	.strict();

const GameSaveItemSpawnJobSeedCellSchema = z
	.object({
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

const GameSaveItemSpawnJobBaseSchema = z
	.object({
		id: IdSchema,
		readyAtMs: GameInstantMsSchema,
		exclusiveGroupKey: IdSchema.optional(),
		afterJobIds: z.array(IdSchema).optional(),
		lastBlockedAtMs: GameInstantMsSchema.optional(),
		seedCell: GameSaveItemSpawnJobSeedCellSchema.optional(),
		sequenceIndex: NonNegativeIntegerSchema.optional(),
	})
	.strict()
	.refine(
		(value) =>
			!value.afterJobIds || new Set(value.afterJobIds).size === value.afterJobIds.length,
		{
			message: "afterJobIds must be unique",
			path: [
				"afterJobIds",
			],
		},
	);

const GameSaveItemSpawnJobSchema = GameSaveItemSpawnJobBaseSchema.extend({
	itemId: IdSchema,
	originItemInstanceId: IdSchema.optional(),
	quantity: PositiveIntegerSchema,
	reason: GameItemCreatedReasonSchema,
	type: z.literal("item.spawn"),
})
	.strict()
	.refine((value) => !value.exclusiveGroupKey || value.exclusiveGroupKey !== value.id, {
		message: "exclusiveGroupKey must group jobs and must not equal job id",
		path: [
			"exclusiveGroupKey",
		],
	})
	.refine((value) => !value.afterJobIds?.includes(value.id), {
		message: "afterJobIds must not contain job id",
		path: [
			"afterJobIds",
		],
	});

export const GameSaveSchema = z
	.object({
		version: z.literal(1),
		gameId: IdSchema,
		createdAtMs: GameInstantMsSchema,
		updatedAtMs: GameInstantMsSchema,
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
		activeEffects: z.record(IdSchema, GameSaveActiveEffectSchema).default({}),
		cheats: GameSaveCheatStateSchema.optional(),
		boardMemoryLayouts: z.record(IdSchema, GameSaveBoardMemoryLayoutSchema).default({}),
		itemCapacities: z.record(IdSchema, GameSaveItemCapacityStateSchema).default({}),
		lines: z.record(IdSchema, GameSaveLineStateSchema),
		producerInputs: z.record(IdSchema, GameSaveProducerInputStateSchema),
		producerCharges: z.record(IdSchema, GameSaveProducerChargeStateSchema).default({}),
		craftJobs: z.record(IdSchema, GameSaveCraftJobSchema),
		craftInputs: z.record(IdSchema, GameSaveCraftInputStateSchema),
		itemSpawnJobs: z.record(IdSchema, GameSaveItemSpawnJobSchema),
	})
	.strict()
	.refine((value) => value.updatedAtMs >= value.createdAtMs, {
		message: "updatedAtMs must be >= createdAtMs",
		path: [
			"updatedAtMs",
		],
	});

// Intentional dense core contract.
//
// Keep the save shape and its cross-config validation close together unless a
// future refactor has a concrete, proven reason to split them. This file is
// allowed to be large because it is the central save/config contract; do not
// treat line count alone as a simplification target. Still update this contract
// when runtime/schema changes require it.

export type GameSaveBoardItem = z.infer<typeof GameSaveBoardItemSchema>;
export type GameSaveInventoryStack = z.infer<typeof GameSaveInventoryStackSchema>;
export type GameSaveInventoryInstance = z.infer<typeof GameSaveInventoryInstanceSchema>;
export type GameSaveInventorySlot = z.infer<typeof GameSaveInventorySlotSchema>;
export type GameSaveProducerJob = z.infer<typeof GameSaveProducerJobSchema>;
export type GameSaveCraftJob = z.infer<typeof GameSaveCraftJobSchema>;
export type GameSaveItemSpawnJob = z.infer<typeof GameSaveItemSpawnJobSchema>;
export type GameSave = z.infer<typeof GameSaveSchema>;
