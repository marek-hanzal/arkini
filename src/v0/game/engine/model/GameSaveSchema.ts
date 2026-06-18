import { z } from "zod";
import { GameConfigSchema, type GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameSaveUpgradeJobSchema } from "~/v0/game/engine/model/GameSaveUpgradeJobSchema";
import { GameSaveUpgradeStateSchema } from "~/v0/game/engine/model/GameSaveUpgradeStateSchema";
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
	save,
	itemInstanceId,
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
	save,
	itemInstanceId,
}: {
	config: GameConfig;
	save: GameSave;
	itemInstanceId: string;
}) => {
	const board = readBoardItemDefinition({
		config,
		itemInstanceId,
		save,
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

const readStoredRequirementSlots = ({
	config,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	save: GameSave;
	targetItemInstanceId: string;
}) => {
	const target = readItemInstanceDefinition({
		config,
		itemInstanceId: targetItemInstanceId,
		save,
	});
	if (!target) return [];

	const requirements = [];

	if (target.item.producerId) {
		const producer = config.producers[target.item.producerId];
		if (producer) {
			requirements.push(...producer.requirements);
			for (const productId of producer.productIds) {
				const product = config.products[productId];
				if (product) requirements.push(...product.requirements);
			}
		}
	}

	if (target.item.craftRecipeId) {
		const recipe = config.craftRecipes[target.item.craftRecipeId];
		if (recipe) requirements.push(...recipe.requirements);
	}

	if (target.item.stashId) {
		const stash = config.stashes[target.item.stashId];
		if (stash) requirements.push(...stash.requirements);
	}

	return requirements.filter((requirement) => requirement.type === "stored");
};

const readStoredRequirementCapacity = ({
	config,
	itemId,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => {
	const matchingSlots = readStoredRequirementSlots({
		config,
		save,
		targetItemInstanceId,
	}).filter((requirement) => requirement.itemId === itemId);

	if (matchingSlots.length === 0) return undefined;
	return Math.max(...matchingSlots.map((requirement) => requirement.capacity));
};

const readEffectiveProducerMaxQueueSize = ({
	config,
	producerId,
	save,
}: {
	config: GameConfig;
	producerId: string;
	save: GameSave;
}) => {
	let maxQueueSize = config.producers[producerId]?.maxQueueSize;
	if (typeof maxQueueSize !== "number") return undefined;

	for (const [upgradeId, upgrade] of Object.entries(config.upgrades).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const completedTiers = Math.min(
			save.upgrades[upgradeId]?.completedTiers ?? 0,
			upgrade.tiers.length,
		);

		for (const tier of upgrade.tiers.slice(0, completedTiers)) {
			for (const effect of tier.effects) {
				if (
					effect.type !== "producer.maxQueueSize.add" ||
					effect.producerId !== producerId
				) {
					continue;
				}

				maxQueueSize += effect.quantity;
			}
		}
	}

	return maxQueueSize;
};

const readEffectiveProductInputRefId = ({
	config,
	productId,
	save,
}: {
	config: GameConfig;
	productId: string;
	save: GameSave;
}) => {
	let inputRefId = config.products[productId]?.inputRefId;

	for (const [upgradeId, upgrade] of Object.entries(config.upgrades).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const completedTiers = Math.min(
			save.upgrades[upgradeId]?.completedTiers ?? 0,
			upgrade.tiers.length,
		);

		for (const tier of upgrade.tiers.slice(0, completedTiers)) {
			for (const effect of tier.effects) {
				if (effect.type === "product.inputRef.set" && effect.productId === productId) {
					inputRefId = effect.inputRefId;
				}
			}
		}
	}

	return inputRefId;
};

const readEffectiveProductInputSlots = ({
	config,
	productId,
	save,
}: {
	config: GameConfig;
	productId: string;
	save: GameSave;
}) => {
	const inputRefId = readEffectiveProductInputRefId({
		config,
		productId,
		save,
	});
	if (!inputRefId) return [];

	return config.inputs[inputRefId]?.inputs ?? [];
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

		if (!config.items[boardItem.itemId]) {
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

	const producerJobCountByProducerItemInstanceId = new Map<string, number>();
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
			itemInstanceId: job.producerItemInstanceId,
			save,
		});
		const producerId = target?.item.producerId;
		const producer = producerId ? config.producers[producerId] : undefined;

		if (!target) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"producerItemInstanceId",
				],
				`Producer job target "${job.producerItemInstanceId}" must be a board item.`,
			);
		} else if (!producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"producerItemInstanceId",
				],
				`Producer job target "${job.producerItemInstanceId}" must reference a producer item.`,
			);
		} else if (!producer.productIds.includes(job.productId)) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"productId",
				],
				`Product "${job.productId}" does not belong to producer "${producerId}".`,
			);
		}

		if (!config.products[job.productId]) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"productId",
				],
				`Missing product "${job.productId}".`,
			);
		}

		if (job.outputTableId !== null && !config.lootTables[job.outputTableId]) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"outputTableId",
				],
				`Missing loot table "${job.outputTableId}".`,
			);
		}

		if (job.delivery && job.outputTableId === null) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"delivery",
				],
				"Producer delivery requires an output table.",
			);
		}

		if (job.delivery) {
			for (const [index, deliveryItem] of job.delivery.items.entries()) {
				if (!config.items[deliveryItem.itemId]) {
					addSaveIssue(
						ctx,
						[
							"producerJobs",
							jobId,
							"delivery",
							"items",
							index,
							"itemId",
						],
						`Missing item "${deliveryItem.itemId}".`,
					);
				}
			}
		}

		producerJobCountByProducerItemInstanceId.set(
			job.producerItemInstanceId,
			(producerJobCountByProducerItemInstanceId.get(job.producerItemInstanceId) ?? 0) + 1,
		);
	}

	for (const [producerItemInstanceId, jobCount] of producerJobCountByProducerItemInstanceId) {
		const target = readBoardItemDefinition({
			config,
			itemInstanceId: producerItemInstanceId,
			save,
		});
		const producerId = target?.item.producerId;
		if (!producerId) continue;
		const maxQueueSize = readEffectiveProducerMaxQueueSize({
			config,
			producerId,
			save,
		});
		if (maxQueueSize !== undefined && jobCount > maxQueueSize) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
				],
				`Producer "${producerItemInstanceId}" queue has ${jobCount} jobs but maxQueueSize is ${maxQueueSize}.`,
			);
		}
	}

	for (const [producerItemInstanceId, lineState] of Object.entries(save.producerLines)) {
		const target = readItemInstanceDefinition({
			config,
			itemInstanceId: producerItemInstanceId,
			save,
		});
		const producerId = target?.item.producerId;
		const producer = producerId ? config.producers[producerId] : undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerLines",
					producerItemInstanceId,
				],
				`Producer line state target "${producerItemInstanceId}" must reference a producer item.`,
			);
			continue;
		}

		for (const [index, productId] of lineState.disabledProductIds.entries()) {
			if (!producer.productIds.includes(productId)) {
				addSaveIssue(
					ctx,
					[
						"producerLines",
						producerItemInstanceId,
						"disabledProductIds",
						index,
					],
					`Disabled product "${productId}" does not belong to producer "${producerId}".`,
				);
			}
		}
	}

	for (const [producerItemInstanceId, state] of Object.entries(save.producerInputs)) {
		const target = readItemInstanceDefinition({
			config,
			itemInstanceId: producerItemInstanceId,
			save,
		});
		const producerId = target?.item.producerId;
		const producer = producerId ? config.producers[producerId] : undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerInputs",
					producerItemInstanceId,
				],
				`Producer input state target "${producerItemInstanceId}" must reference a producer item.`,
			);
			continue;
		}

		for (const [productId, productInputState] of Object.entries(state.productInputs)) {
			if (!producer.productIds.includes(productId)) {
				addSaveIssue(
					ctx,
					[
						"producerInputs",
						producerItemInstanceId,
						"productInputs",
						productId,
					],
					`Product "${productId}" does not belong to producer "${producerId}".`,
				);
				continue;
			}

			const inputSlots = readEffectiveProductInputSlots({
				config,
				productId,
				save,
			});

			for (const [itemId, quantity] of Object.entries(productInputState.items)) {
				const inputSlot = inputSlots.find((input) => input.itemId === itemId);
				if (!inputSlot) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							producerItemInstanceId,
							"productInputs",
							productId,
							"items",
							itemId,
						],
						`Product "${productId}" has no input "${itemId}".`,
					);
					continue;
				}

				if (quantity > inputSlot.capacity) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							producerItemInstanceId,
							"productInputs",
							productId,
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

		const recipe = config.craftRecipes[job.recipeId];
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
			itemInstanceId: job.targetItemInstanceId,
			save,
		});
		if (!target || target.item.craftRecipeId !== job.recipeId) {
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
			itemInstanceId: targetItemInstanceId,
			save,
		});
		const recipeId = target?.item.craftRecipeId;
		const recipe = recipeId ? config.craftRecipes[recipeId] : undefined;
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

	const runningUpgradeJobs = new Set<string>();
	for (const [jobId, job] of Object.entries(save.upgradeJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"upgradeJobs",
					jobId,
					"id",
				],
				`Upgrade job id must match record key "${jobId}".`,
			);
		}

		const upgrade = config.upgrades[job.upgradeId];
		if (!upgrade) {
			addSaveIssue(
				ctx,
				[
					"upgradeJobs",
					jobId,
					"upgradeId",
				],
				`Missing upgrade "${job.upgradeId}".`,
			);
			continue;
		}

		if (job.tierIndex >= upgrade.tiers.length) {
			addSaveIssue(
				ctx,
				[
					"upgradeJobs",
					jobId,
					"tierIndex",
				],
				`tierIndex must be < upgrade tier count (${upgrade.tiers.length}).`,
			);
		}

		if (runningUpgradeJobs.has(job.upgradeId)) {
			addSaveIssue(
				ctx,
				[
					"upgradeJobs",
					jobId,
				],
				`Upgrade "${job.upgradeId}" already has a running job.`,
			);
		} else {
			runningUpgradeJobs.add(job.upgradeId);
		}
	}

	for (const [upgradeId, state] of Object.entries(save.upgrades)) {
		const upgrade = config.upgrades[upgradeId];
		if (!upgrade) {
			addSaveIssue(
				ctx,
				[
					"upgrades",
					upgradeId,
				],
				`Missing upgrade "${upgradeId}".`,
			);
			continue;
		}

		if (state.completedTiers > upgrade.tiers.length) {
			addSaveIssue(
				ctx,
				[
					"upgrades",
					upgradeId,
					"completedTiers",
				],
				`completedTiers must be <= upgrade tier count (${upgrade.tiers.length}).`,
			);
		}
	}

	for (const [stashItemInstanceId, state] of Object.entries(save.stashes)) {
		const target = readItemInstanceDefinition({
			config,
			itemInstanceId: stashItemInstanceId,
			save,
		});
		const stashId = target?.item.stashId;
		const stash = stashId ? config.stashes[stashId] : undefined;
		if (!target || !stashId || !stash) {
			addSaveIssue(
				ctx,
				[
					"stashes",
					stashItemInstanceId,
				],
				`Stash state target "${stashItemInstanceId}" must reference a stash item.`,
			);
			continue;
		}

		if (state.remainingCharges > stash.charges) {
			addSaveIssue(
				ctx,
				[
					"stashes",
					stashItemInstanceId,
					"remainingCharges",
				],
				`remainingCharges must be <= stash charges (${stash.charges}).`,
			);
		}
	}

	for (const [targetItemInstanceId, state] of Object.entries(save.storedRequirements)) {
		const target = readItemInstanceDefinition({
			config,
			itemInstanceId: targetItemInstanceId,
			save,
		});
		if (!target) {
			addSaveIssue(
				ctx,
				[
					"storedRequirements",
					targetItemInstanceId,
				],
				`Stored requirement target "${targetItemInstanceId}" must reference a save item instance.`,
			);
			continue;
		}

		for (const [itemId, quantity] of Object.entries(state.items)) {
			if (!config.items[itemId]) {
				addSaveIssue(
					ctx,
					[
						"storedRequirements",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Missing item "${itemId}".`,
				);
				continue;
			}

			const capacity = readStoredRequirementCapacity({
				config,
				itemId,
				save,
				targetItemInstanceId,
			});
			if (capacity === undefined) {
				addSaveIssue(
					ctx,
					[
						"storedRequirements",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Item "${itemId}" is not accepted by target stored requirements.`,
				);
				continue;
			}

			if (quantity > capacity) {
				addSaveIssue(
					ctx,
					[
						"storedRequirements",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Quantity must be <= stored requirement capacity (${capacity}).`,
				);
			}
		}
	}

	for (const [eventId, event] of Object.entries(save.scheduledEvents)) {
		if (event.id !== eventId) {
			addSaveIssue(
				ctx,
				[
					"scheduledEvents",
					eventId,
					"id",
				],
				`Scheduled event id must match record key "${eventId}".`,
			);
		}

		if (!config.items[event.itemId]) {
			addSaveIssue(
				ctx,
				[
					"scheduledEvents",
					eventId,
					"itemId",
				],
				`Missing item "${event.itemId}".`,
			);
		}
	}
};

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
