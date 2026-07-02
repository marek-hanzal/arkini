import { z } from "zod";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";
import { GameConfigSchema } from "~/config/GameConfigSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readGameConfigEffect } from "~/config/readGameConfigEffects";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import { readLineKind } from "~/producer/readLineKind";
import { GameItemCreatedReasonSchema } from "~/event/GameEventSchema";

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

const GameSaveSchema = z
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

export const GameSaveConfigSchema = z
	.object({
		config: GameConfigSchema,
		save: GameSaveSchema,
	})
	.strict()
	.superRefine(({ config, save }, ctx) => {
		validateGameSaveAgainstConfig(ctx, save, config);
	});

const addSaveIssue = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
	ctx.addIssue({
		code: "custom",
		message,
		path: [
			"save",
			...path,
		],
	});
};

const readBoardItemDefinition = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	save: GameSave;
	itemInstanceId: string;
}) => {
	const boardItem = save.board.items[itemInstanceId];
	if (!boardItem) return undefined;
	const item = config.items[boardItem.itemId];
	if (!item) return undefined;
	return {
		boardItem,
		item,
	};
};

const readItemInstanceDefinition = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	save: GameSave;
	itemInstanceId: string;
}) => {
	const board = readBoardItemDefinition({
		config,
		save,
		itemInstanceId,
	});
	if (board) {
		return {
			item: board.item,
			itemId: board.boardItem.itemId,
			location: "board" as const,
		};
	}

	for (const [slotIndex, slot] of save.inventory.slots.entries()) {
		if (!slot || !("kind" in slot) || slot.kind !== "instance" || slot.id !== itemInstanceId) {
			continue;
		}

		const item = config.items[slot.itemId];
		if (!item) return undefined;
		return {
			item,
			itemId: slot.itemId,
			location: "inventory" as const,
			slotIndex,
		};
	}

	return undefined;
};

const readEffectiveLineInputSlots = ({
	producer,
	lineId,
}: {
	producer: NonNullable<ReturnType<typeof readProducerCapabilityDefinition>>;
	lineId: string;
}) =>
	readLineDefinition({
		producerDefinition: producer,
		lineId,
	})?.inputs ?? [];

const readLineFromJob = ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}) => {
	const producerItem = save.board.items[job.itemInstanceId];
	const producer = producerItem
		? readProducerCapabilityDefinition({
				config,
				producerId: producerItem.itemId,
			})
		: undefined;

	return producer
		? readLineDefinition({
				producerDefinition: producer,
				lineId: job.lineId,
			})
		: undefined;
};

const isSaveProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

const readProducerQueueBarrierAtMs = (job: GameSaveProducerJob) =>
	isSaveProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);

const readItemSpawnDependencyCycleJobIds = (save: GameSave) => {
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const cycleJobIds = new Set<string>();

	const visit = (jobId: string): boolean => {
		if (visiting.has(jobId)) {
			cycleJobIds.add(jobId);
			return true;
		}
		if (visited.has(jobId)) return cycleJobIds.has(jobId);

		const job = save.itemSpawnJobs[jobId];
		if (!job) return false;

		visiting.add(jobId);
		let hasCycle = false;
		for (const dependencyId of job.afterJobIds ?? []) {
			if (visit(dependencyId)) {
				hasCycle = true;
				cycleJobIds.add(jobId);
			}
		}
		visiting.delete(jobId);
		visited.add(jobId);
		return hasCycle;
	};

	for (const jobId of Object.keys(save.itemSpawnJobs)) {
		visit(jobId);
	}

	return cycleJobIds;
};

const validateGameSaveAgainstConfig = (
	ctx: z.RefinementCtx,
	save: GameSave,
	config: GameConfig,
) => {
	if (save.gameId !== config.game.id) {
		addSaveIssue(
			ctx,
			[
				"gameId",
			],
			`Save gameId must match config game id "${config.game.id}".`,
		);
	}

	if (save.inventory.slots.length !== config.game.inventory.slots) {
		addSaveIssue(
			ctx,
			[
				"inventory",
				"slots",
			],
			`Inventory slot count must equal config inventory slots (${config.game.inventory.slots}).`,
		);
	}

	const usedBoardCells = new Map<string, string>();
	const boardItemCountByItemId = new Map<string, number>();
	for (const [itemInstanceId, boardItem] of Object.entries(save.board.items)) {
		if (boardItem.id !== itemInstanceId) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"id",
				],
				`Board item id must match record key "${itemInstanceId}".`,
			);
		}

		boardItemCountByItemId.set(
			boardItem.itemId,
			(boardItemCountByItemId.get(boardItem.itemId) ?? 0) + 1,
		);

		const boardItemDefinition = config.items[boardItem.itemId];
		if (!boardItemDefinition) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"itemId",
				],
				`Missing item "${boardItem.itemId}".`,
			);
		} else if (boardItemDefinition.storage === "inventory") {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"itemId",
				],
				`Item "${boardItem.itemId}" storage policy forbids board location.`,
			);
		}

		if (boardItem.x >= config.game.board.width) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"x",
				],
				`x must be < board width (${config.game.board.width}).`,
			);
		}

		if (boardItem.y >= config.game.board.height) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"y",
				],
				`y must be < board height (${config.game.board.height}).`,
			);
		}

		const cellKey = `${boardItem.x}:${boardItem.y}`;
		const firstItemInstanceId = usedBoardCells.get(cellKey);
		if (firstItemInstanceId) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
				],
				`Duplicate board cell (${boardItem.x}, ${boardItem.y}). First used by "${firstItemInstanceId}".`,
			);
		} else {
			usedBoardCells.set(cellKey, itemInstanceId);
		}
	}

	const inventoryInstanceIds = new Set<string>();
	for (const [itemId, quantity] of boardItemCountByItemId) {
		const maxCount = config.items[itemId]?.maxCount;
		if (maxCount === undefined || quantity <= maxCount) continue;

		addSaveIssue(
			ctx,
			[
				"board",
				"items",
			],
			`Board has ${quantity} item(s) of "${itemId}" but maxCount is ${maxCount}.`,
		);
	}

	for (const [slotIndex, slot] of save.inventory.slots.entries()) {
		if (!slot) continue;

		const item = config.items[slot.itemId];
		if (!item) {
			addSaveIssue(
				ctx,
				[
					"inventory",
					"slots",
					slotIndex,
					"itemId",
				],
				`Missing item "${slot.itemId}".`,
			);
			continue;
		}

		if (item.storage === "board") {
			addSaveIssue(
				ctx,
				[
					"inventory",
					"slots",
					slotIndex,
					"itemId",
				],
				`Item "${slot.itemId}" storage policy forbids inventory location.`,
			);
		}

		if ("kind" in slot && slot.kind === "instance") {
			if (save.board.items[slot.id]) {
				addSaveIssue(
					ctx,
					[
						"inventory",
						"slots",
						slotIndex,
						"id",
					],
					`Inventory instance id "${slot.id}" already exists on board.`,
				);
			}

			if (inventoryInstanceIds.has(slot.id)) {
				addSaveIssue(
					ctx,
					[
						"inventory",
						"slots",
						slotIndex,
						"id",
					],
					`Duplicate inventory instance id "${slot.id}".`,
				);
			} else {
				inventoryInstanceIds.add(slot.id);
			}

			continue;
		}

		if (!("kind" in slot) && slot.quantity > item.maxStackSize) {
			addSaveIssue(
				ctx,
				[
					"inventory",
					"slots",
					slotIndex,
					"quantity",
				],
				`Quantity must be <= item maxStackSize (${item.maxStackSize}).`,
			);
		}
	}

	const jobCountByItemInstanceId = new Map<string, number>();
	const jobsByItemInstanceId = new Map<
		string,
		{
			job: GameSaveProducerJob;
			jobId: string;
		}[]
	>();
	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"id",
				],
				`Producer job id must match record key "${jobId}".`,
			);
		}

		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId: job.itemInstanceId,
		});
		const producerId = target?.boardItem.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;

		if (!target) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"itemInstanceId",
				],
				`Producer job target "${job.itemInstanceId}" must be a board item.`,
			);
		} else if (!producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"itemInstanceId",
				],
				`Producer job target "${job.itemInstanceId}" must reference a producer-like item.`,
			);
		} else if (
			!readLineIds({
				producerDefinition: producer,
			}).includes(job.lineId)
		) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"lineId",
				],
				`Line "${job.lineId}" does not belong to producer "${producerId}".`,
			);
		}

		jobCountByItemInstanceId.set(
			job.itemInstanceId,
			(jobCountByItemInstanceId.get(job.itemInstanceId) ?? 0) + 1,
		);
		const producerJobs = jobsByItemInstanceId.get(job.itemInstanceId) ?? [];
		producerJobs.push({
			job,
			jobId,
		});
		jobsByItemInstanceId.set(job.itemInstanceId, producerJobs);
	}

	const activeEffectIdsByProducerJobId = new Map<string, string[]>();

	for (const [activeEffectId, activeEffect] of Object.entries(save.activeEffects ?? {})) {
		if (activeEffect.id !== activeEffectId) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"id",
				],
				`Active effect id must match record key "${activeEffectId}".`,
			);
		}

		if (
			!readGameConfigEffect({
				config,
				effectId: activeEffect.effectId,
			})
		) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"effectId",
				],
				`Missing effect "${activeEffect.effectId}".`,
			);
		}

		if (
			!readItemInstanceDefinition({
				config,
				save,
				itemInstanceId: activeEffect.sourceItemInstanceId,
			})
		) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"sourceItemInstanceId",
				],
				`Active effect source "${activeEffect.sourceItemInstanceId}" must reference a save item instance.`,
			);
		}

		if (activeEffect.producerJobId !== undefined) {
			activeEffectIdsByProducerJobId.set(activeEffect.producerJobId, [
				...(activeEffectIdsByProducerJobId.get(activeEffect.producerJobId) ?? []),
				activeEffectId,
			]);
			const producerJob = save.producerJobs[activeEffect.producerJobId];
			const line = producerJob
				? readLineFromJob({
						config,
						save,
						job: producerJob,
					})
				: undefined;

			if (!producerJob) {
				addSaveIssue(
					ctx,
					[
						"activeEffects",
						activeEffectId,
						"producerJobId",
					],
					`Active effect producer job "${activeEffect.producerJobId}" must reference a producer job.`,
				);
			} else {
				if (activeEffect.sourceItemInstanceId !== producerJob.itemInstanceId) {
					addSaveIssue(
						ctx,
						[
							"activeEffects",
							activeEffectId,
							"sourceItemInstanceId",
						],
						`Active effect source must match producer job "${producerJob.id}" source.`,
					);
				}
				if (activeEffect.startAtMs !== producerJob.startAtMs) {
					addSaveIssue(
						ctx,
						[
							"activeEffects",
							activeEffectId,
							"startAtMs",
						],
						`Active effect startAtMs must match producer job "${producerJob.id}" startAtMs.`,
					);
				}
				if (activeEffect.endAtMs !== producerJob.readyAtMs) {
					addSaveIssue(
						ctx,
						[
							"activeEffects",
							activeEffectId,
							"endAtMs",
						],
						`Active effect endAtMs must match producer job "${producerJob.id}" readyAtMs.`,
					);
				}
				if (line?.effect?.id !== activeEffect.effectId) {
					addSaveIssue(
						ctx,
						[
							"activeEffects",
							activeEffectId,
							"effectId",
						],
						`Active effect must match producer job "${producerJob.id}" activated effect.`,
					);
				}
			}
		}
	}

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		const line = readLineFromJob({
			config,
			save,
			job,
		});
		if (!line?.effect) continue;

		const activeEffectIds = activeEffectIdsByProducerJobId.get(jobId) ?? [];
		const expectedActiveEffectCount = job.delivery ? 0 : 1;
		if (activeEffectIds.length !== expectedActiveEffectCount) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
				],
				job.delivery
					? `Blocked producer job "${jobId}" has completed activated effect "${line.effect.id}" and must not keep a linked active effect.`
					: `Producer job "${jobId}" activates effect "${line.effect.id}" and must have exactly one linked active effect.`,
			);
		}
	}

	for (const [itemInstanceId, jobCount] of jobCountByItemInstanceId) {
		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId: itemInstanceId,
		});
		const producerId = target?.boardItem.itemId;
		if (!producerId) continue;
		const producer = readProducerCapabilityDefinition({
			config,
			producerId,
		});
		if (!producer) continue;
		const maxQueueSize = producer.maxQueueSize;
		if (maxQueueSize !== undefined && jobCount > maxQueueSize) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
				],
				`Producer "${itemInstanceId}" queue has ${jobCount} jobs but maxQueueSize is ${maxQueueSize}.`,
			);
		}
	}

	for (const [itemInstanceId, producerJobs] of jobsByItemInstanceId) {
		const sortedProducerJobs = [
			...producerJobs,
		].sort(
			(left, right) =>
				left.job.startAtMs - right.job.startAtMs ||
				left.job.readyAtMs - right.job.readyAtMs ||
				left.jobId.localeCompare(right.jobId),
		);
		for (let index = 1; index < sortedProducerJobs.length; index += 1) {
			const previous = sortedProducerJobs[index - 1];
			const current = sortedProducerJobs[index];
			if (!previous || !current) continue;

			if (current.job.delivery) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"delivery",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" has blocked delivery but is not first in the producer queue.`,
				);
			}

			const previousQueueBarrierAtMs = readProducerQueueBarrierAtMs(previous.job);
			if (previousQueueBarrierAtMs === undefined) {
				continue;
			}

			if (current.job.startAtMs < previousQueueBarrierAtMs) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"startAtMs",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" starts before previous job "${previous.jobId}" releases the queue.`,
				);
			}
		}

		for (const current of sortedProducerJobs) {
			if (
				!current.job.delivery ||
				current.job.delivery.lastBlockedAtMs >= current.job.readyAtMs
			) {
				continue;
			}

			addSaveIssue(
				ctx,
				[
					"producerJobs",
					current.jobId,
					"delivery",
					"lastBlockedAtMs",
				],
				`Producer job "${current.jobId}" cannot be blocked before it is ready.`,
			);
		}
	}

	for (const [itemInstanceId, lineState] of Object.entries(save.lines)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId: itemInstanceId,
		});
		const producerId = target?.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
				],
				`Line state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		if (
			lineState.defaultLineId !== undefined &&
			!readLineIds({
				producerDefinition: producer,
			}).includes(lineState.defaultLineId)
		) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
					"defaultLineId",
				],
				`Default line "${lineState.defaultLineId}" does not belong to producer "${producerId}".`,
			);
		} else if (lineState.defaultLineId !== undefined) {
			const line = readLineDefinition({
				producerDefinition: producer,
				lineId: lineState.defaultLineId,
			});
			if (
				line &&
				readLineKind({
					line,
				}) !== "product"
			) {
				addSaveIssue(
					ctx,
					[
						"lines",
						itemInstanceId,
						"defaultLineId",
					],
					`Default line "${lineState.defaultLineId}" must reference a normal line.`,
				);
			}
		}

		if (
			lineState.defaultEffectLineId !== undefined &&
			!readLineIds({
				producerDefinition: producer,
			}).includes(lineState.defaultEffectLineId)
		) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
					"defaultEffectLineId",
				],
				`Default effect line "${lineState.defaultEffectLineId}" does not belong to producer "${producerId}".`,
			);
		} else if (lineState.defaultEffectLineId !== undefined) {
			const effectLine = readLineDefinition({
				producerDefinition: producer,
				lineId: lineState.defaultEffectLineId,
			});
			if (
				effectLine &&
				readLineKind({
					line: effectLine,
				}) !== "effect"
			) {
				addSaveIssue(
					ctx,
					[
						"lines",
						itemInstanceId,
						"defaultEffectLineId",
					],
					`Default effect line "${lineState.defaultEffectLineId}" must reference an effect line.`,
				);
			}
		}
	}

	for (const [itemInstanceId, state] of Object.entries(save.producerInputs)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId: itemInstanceId,
		});
		const producerId = target?.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerInputs",
					itemInstanceId,
				],
				`Producer input state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		for (const [lineId, lineInputState] of Object.entries(state.lineInputs)) {
			if (
				!readLineIds({
					producerDefinition: producer,
				}).includes(lineId)
			) {
				addSaveIssue(
					ctx,
					[
						"producerInputs",
						itemInstanceId,
						"lineInputs",
						lineId,
					],
					`Line "${lineId}" does not belong to producer "${producerId}".`,
				);
				continue;
			}

			const inputSlots = readEffectiveLineInputSlots({
				producer,
				lineId,
			});

			for (const [itemId, quantity] of Object.entries(lineInputState.items)) {
				const inputSlot = inputSlots.find((input) => input.itemId === itemId);
				if (!inputSlot) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							itemInstanceId,
							"lineInputs",
							lineId,
							"items",
							itemId,
						],
						`Line "${lineId}" has no input "${itemId}".`,
					);
					continue;
				}

				if (quantity > inputSlot.capacity) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							itemInstanceId,
							"lineInputs",
							lineId,
							"items",
							itemId,
						],
						`Stored input quantity must be <= capacity (${inputSlot.capacity}).`,
					);
				}
			}
		}
	}

	const runningCraftJobsByTargetItemInstanceId = new Map<string, string>();
	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"id",
				],
				`Craft job id must match record key "${jobId}".`,
			);
		}

		const recipe = readCraftRecipeDefinition({
			config,
			recipeId: job.recipeId,
		});
		if (!recipe) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"recipeId",
				],
				`Missing craft recipe "${job.recipeId}".`,
			);
		}

		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId: job.targetItemInstanceId,
		});
		if (!target || target.boardItem.itemId !== job.recipeId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"targetItemInstanceId",
				],
				`Craft job target "${job.targetItemInstanceId}" must reference item recipe "${job.recipeId}".`,
			);
		}

		if (job.delivery && job.delivery.lastBlockedAtMs < job.readyAtMs) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"delivery",
					"lastBlockedAtMs",
				],
				`Craft job "${jobId}" cannot be blocked before it is ready.`,
			);
		}

		const runningJobId = runningCraftJobsByTargetItemInstanceId.get(job.targetItemInstanceId);
		if (runningJobId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"targetItemInstanceId",
				],
				`Craft target "${job.targetItemInstanceId}" already has running job "${runningJobId}".`,
			);
		} else {
			runningCraftJobsByTargetItemInstanceId.set(job.targetItemInstanceId, jobId);
		}
	}

	for (const [targetItemInstanceId, state] of Object.entries(save.craftInputs)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId: targetItemInstanceId,
		});
		const recipeId = target?.itemId;
		const recipe = recipeId
			? readCraftRecipeDefinition({
					config,
					recipeId,
				})
			: undefined;
		if (!target || !recipeId || !recipe) {
			addSaveIssue(
				ctx,
				[
					"craftInputs",
					targetItemInstanceId,
				],
				`Craft input state target "${targetItemInstanceId}" must reference a craft item.`,
			);
			continue;
		}

		const runningJobId = runningCraftJobsByTargetItemInstanceId.get(targetItemInstanceId);
		if (runningJobId) {
			addSaveIssue(
				ctx,
				[
					"craftInputs",
					targetItemInstanceId,
				],
				`Craft target "${targetItemInstanceId}" has running job "${runningJobId}" and must not have editable input state.`,
			);
		}

		for (const [itemId, quantity] of Object.entries(state.items)) {
			const inputSlot = recipe.inputs.find((input) => input.itemId === itemId);
			if (!inputSlot) {
				addSaveIssue(
					ctx,
					[
						"craftInputs",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Craft recipe "${recipeId}" has no input "${itemId}".`,
				);
				continue;
			}

			if (quantity > inputSlot.quantity) {
				addSaveIssue(
					ctx,
					[
						"craftInputs",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Craft input quantity must be <= recipe input quantity (${inputSlot.quantity}).`,
				);
			}
		}
	}

	for (const [itemInstanceId, state] of Object.entries(save.producerCharges)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId: itemInstanceId,
		});
		const producerId = target?.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerCharges",
					itemInstanceId,
				],
				`Producer charge state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		if (producer.charges === undefined) {
			addSaveIssue(
				ctx,
				[
					"producerCharges",
					itemInstanceId,
				],
				`Producer charge state target "${itemInstanceId}" references a producer-like item without finite charges.`,
			);
			continue;
		}

		if (state.remainingCharges > producer.charges) {
			addSaveIssue(
				ctx,
				[
					"producerCharges",
					itemInstanceId,
					"remainingCharges",
				],
				`remainingCharges must be <= producer charges (${producer.charges}).`,
			);
		}
	}

	for (const [jobId, job] of Object.entries(save.itemSpawnJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"itemSpawnJobs",
					jobId,
					"id",
				],
				`Item spawn job id must match record key "${jobId}".`,
			);
		}

		if (!config.items[job.itemId]) {
			addSaveIssue(
				ctx,
				[
					"itemSpawnJobs",
					jobId,
					"itemId",
				],
				`Missing item "${job.itemId}".`,
			);
		}

		for (const [dependencyIndex, afterJobId] of (job.afterJobIds ?? []).entries()) {
			if (!save.itemSpawnJobs[afterJobId]) {
				addSaveIssue(
					ctx,
					[
						"itemSpawnJobs",
						jobId,
						"afterJobIds",
						dependencyIndex,
					],
					`Item spawn job dependency "${afterJobId}" must reference an existing item spawn job.`,
				);
			}
		}
	}

	const itemSpawnDependencyCycleJobIds = readItemSpawnDependencyCycleJobIds(save);
	for (const jobId of itemSpawnDependencyCycleJobIds) {
		addSaveIssue(
			ctx,
			[
				"itemSpawnJobs",
				jobId,
				"afterJobIds",
			],
			`Item spawn job "${jobId}" must not be part of a dependency cycle.`,
		);
	}
};

export type GameSaveBoardItem = z.infer<typeof GameSaveBoardItemSchema>;
export type GameSaveInventoryStack = z.infer<typeof GameSaveInventoryStackSchema>;
export type GameSaveInventoryInstance = z.infer<typeof GameSaveInventoryInstanceSchema>;
export type GameSaveInventorySlot = z.infer<typeof GameSaveInventorySlotSchema>;
export type GameSaveProducerJob = z.infer<typeof GameSaveProducerJobSchema>;
export type GameSaveCraftJob = z.infer<typeof GameSaveCraftJobSchema>;
export type GameSaveItemSpawnJob = z.infer<typeof GameSaveItemSpawnJobSchema>;
export type GameSave = z.infer<typeof GameSaveSchema>;
