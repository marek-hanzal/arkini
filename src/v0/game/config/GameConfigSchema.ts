import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();
const SignedIntegerSchema = z.number().int();
const PlacementSchema = z.enum([
	"board_then_inventory",
]);

const QuantitySchema = z.union([
	PositiveIntegerSchema,
	z
		.object({
			min: PositiveIntegerSchema,
			max: PositiveIntegerSchema,
		})
		.strict()
		.refine((value) => value.max >= value.min, {
			message: "max must be >= min",
		}),
]);

const ItemStackInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		capacity: PositiveIntegerSchema,
		consume: z.boolean(),
	})
	.strict();

const CraftRecipeInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		consume: z.boolean(),
	})
	.strict();

const StoredItemRequirementSchema = z
	.object({
		type: z.literal("stored"),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		capacity: PositiveIntegerSchema,
	})
	.strict();

const PassiveItemRequirementSchema = z
	.object({
		type: z.literal("passive"),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		scope: z.enum([
			"board",
			"inventory",
			"board_or_inventory",
		]),
	})
	.strict();

const ActivationInputSchema = z.array(ItemStackInputSchema);
const ActivationRequirementSchema = z.array(
	z.discriminatedUnion("type", [
		StoredItemRequirementSchema,
		PassiveItemRequirementSchema,
	]),
);

const ActivationOutputSchema = z.array(
	z.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("guaranteed"),
				itemId: IdSchema,
				quantity: QuantitySchema.optional(),
			})
			.strict(),
		z
			.object({
				type: z.literal("chance"),
				itemId: IdSchema,
				chance: z.number().min(0).max(1),
				quantity: QuantitySchema.optional(),
			})
			.strict(),
		z
			.object({
				type: z.literal("weighted"),
				rolls: QuantitySchema.optional(),
				entries: z
					.array(
						z
							.object({
								itemId: IdSchema,
								weight: PositiveIntegerSchema,
								quantity: QuantitySchema.optional(),
							})
							.strict(),
					)
					.min(1),
			})
			.strict(),
	]),
);

const GameMetaSchema = z
	.object({
		id: IdSchema,
		title: z.string().min(1),
		board: z
			.object({
				width: PositiveIntegerSchema,
				height: PositiveIntegerSchema,
			})
			.strict(),
		inventory: z
			.object({
				slots: PositiveIntegerSchema,
			})
			.strict(),
	})
	.strict();

const ResourceDefinitionSchema = z
	.object({
		data: z.string().min(1),
	})
	.strict();

const AssetDefinitionSchema = z
	.object({
		kind: z.enum([
			"item",
			"ui",
		]),
		label: z.string().min(1),
		resourceId: IdSchema,
		overlayAssetId: IdSchema.optional(),
		render: z
			.enum([
				"plain",
				"blueprint",
			])
			.optional(),
		sort: NonNegativeIntegerSchema,
	})
	.strict();

const MergeDefinitionSchema = z
	.object({
		withItemId: IdSchema,
		resultItemId: IdSchema,
		consumeSource: z.boolean().optional(),
		secret: z.boolean().optional(),
	})
	.strict();

const RemoveByDefinitionSchema = z
	.object({
		itemId: IdSchema,
		mode: z.enum([
			"keep",
			"consume",
		]),
	})
	.strict();

const ItemDefinitionSchema = z
	.object({
		assetId: IdSchema,
		code: z.string().min(1),
		name: z.string().min(1),
		tier: NonNegativeIntegerSchema,
		maxStackSize: PositiveIntegerSchema,
		description: z.string(),
		label: z.string().optional(),
		tags: z.array(z.string().min(1)),
		sort: NonNegativeIntegerSchema,
		mergeIds: z.array(IdSchema).optional(),
		producerId: IdSchema.optional(),
		stashId: IdSchema.optional(),
		craftRecipeId: IdSchema.optional(),
		removeBy: z.array(RemoveByDefinitionSchema).optional(),
	})
	.strict();

const ProducerDefinitionSchema = z
	.object({
		type: z.literal("producer"),
		productIds: z.array(IdSchema).min(1),
		requirements: ActivationRequirementSchema,
	})
	.strict();

const StashDefinitionSchema = z
	.object({
		type: z.literal("stash"),
		placement: PlacementSchema,
		outputTableId: IdSchema,
		inputs: ActivationInputSchema,
		requirements: ActivationRequirementSchema,
		charges: PositiveIntegerSchema,
		onDepleted: z.union([
			z.literal("remove"),
			z
				.object({
					replaceWithItemId: IdSchema,
				})
				.strict(),
		]),
	})
	.strict();

const CraftRecipeSchema = z
	.object({
		resultItemId: IdSchema,
		inputs: z.array(CraftRecipeInputSchema),
		requirements: ActivationRequirementSchema,
		durationMs: NonNegativeIntegerSchema,
	})
	.strict();

const LootTableDefinitionSchema = z
	.object({
		name: z.string().min(1),
		output: ActivationOutputSchema.min(1),
	})
	.strict();

const ProductDefinitionSchema = z
	.object({
		name: z.string().min(1),
		durationMs: NonNegativeIntegerSchema,
		placement: PlacementSchema,
		inputs: ActivationInputSchema,
		requirements: ActivationRequirementSchema,
		outputTableId: IdSchema.optional(),
	})
	.strict();

const UpgradeCostDefinitionSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict();

const UpgradeEffectDefinitionSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("product.duration.add"),
			productId: IdSchema,
			ms: SignedIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("product.outputTable.set"),
			productId: IdSchema,
			tableId: IdSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("product.input.quantity.add"),
			productId: IdSchema,
			itemId: IdSchema,
			quantity: SignedIntegerSchema,
		})
		.strict(),
]);

const UpgradeTierDefinitionSchema = z
	.object({
		cost: z.array(UpgradeCostDefinitionSchema),
		effects: z.array(UpgradeEffectDefinitionSchema),
		durationMs: NonNegativeIntegerSchema,
	})
	.strict();

const UpgradeDefinitionSchema = z
	.object({
		code: z.string().min(1),
		name: z.string().min(1),
		description: z.string(),
		sort: NonNegativeIntegerSchema,
		tiers: z.array(UpgradeTierDefinitionSchema).min(1),
	})
	.strict();

const StartingStateDefinitionSchema = z
	.object({
		inventory: z.array(
			z
				.object({
					itemId: IdSchema,
					quantity: PositiveIntegerSchema,
				})
				.strict(),
		),
		board: z.array(
			z
				.object({
					itemId: IdSchema,
					x: NonNegativeIntegerSchema,
					y: NonNegativeIntegerSchema,
				})
				.strict(),
		),
	})
	.strict();

const GameConfigFragmentSchema = z
	.object({
		version: z.literal(1).optional(),
		game: GameMetaSchema.optional(),
		resources: z.record(IdSchema, ResourceDefinitionSchema).optional(),
		assets: z.record(IdSchema, AssetDefinitionSchema).optional(),
		items: z.record(IdSchema, ItemDefinitionSchema).optional(),
		merge: z.record(IdSchema, MergeDefinitionSchema).optional(),
		producers: z.record(IdSchema, ProducerDefinitionSchema).optional(),
		stashes: z.record(IdSchema, StashDefinitionSchema).optional(),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema).optional(),
		products: z.record(IdSchema, ProductDefinitionSchema).optional(),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema).optional(),
		upgrades: z.record(IdSchema, UpgradeDefinitionSchema).optional(),
		startingState: StartingStateDefinitionSchema.optional(),
	})
	.strict();

const BaseGameConfigSchema = z
	.object({
		version: z.literal(1),
		game: GameMetaSchema,
		resources: z.record(IdSchema, ResourceDefinitionSchema),
		assets: z.record(IdSchema, AssetDefinitionSchema),
		items: z.record(IdSchema, ItemDefinitionSchema),
		merge: z.record(IdSchema, MergeDefinitionSchema),
		producers: z.record(IdSchema, ProducerDefinitionSchema),
		stashes: z.record(IdSchema, StashDefinitionSchema),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema),
		products: z.record(IdSchema, ProductDefinitionSchema),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema),
		upgrades: z.record(IdSchema, UpgradeDefinitionSchema),
		startingState: StartingStateDefinitionSchema,
	})
	.strict();

export const GameConfigSchema = BaseGameConfigSchema.superRefine((value, ctx) => {
	const hasResource = createRecordGuard(value.resources);
	const hasAsset = createRecordGuard(value.assets);
	const hasItem = createRecordGuard(value.items);
	const hasMerge = createRecordGuard(value.merge);
	const hasProducer = createRecordGuard(value.producers);
	const hasProduct = createRecordGuard(value.products);
	const hasStash = createRecordGuard(value.stashes);
	const hasCraftRecipe = createRecordGuard(value.craftRecipes);
	const hasLootTable = createRecordGuard(value.lootTables);

	for (const [assetId, asset] of Object.entries(value.assets)) {
		if (!hasResource(asset.resourceId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"resourceId",
				],
				`Missing resource "${asset.resourceId}".`,
			);
		}

		if (asset.overlayAssetId && !hasAsset(asset.overlayAssetId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"overlayAssetId",
				],
				`Missing overlay asset "${asset.overlayAssetId}".`,
			);
		}
	}

	for (const [itemId, item] of Object.entries(value.items)) {
		if (!hasAsset(item.assetId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"assetId",
				],
				`Missing asset "${item.assetId}".`,
			);
		}

		for (const [index, mergeId] of (item.mergeIds ?? []).entries()) {
			if (!hasMerge(mergeId)) {
				addIssue(
					ctx,
					[
						"items",
						itemId,
						"mergeIds",
						index,
					],
					`Missing merge "${mergeId}".`,
				);
			}
		}

		if (item.producerId && !hasProducer(item.producerId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"producerId",
				],
				`Missing producer "${item.producerId}".`,
			);
		}

		if (item.stashId && !hasStash(item.stashId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"stashId",
				],
				`Missing stash "${item.stashId}".`,
			);
		}

		if (item.craftRecipeId && !hasCraftRecipe(item.craftRecipeId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"craftRecipeId",
				],
				`Missing craft recipe "${item.craftRecipeId}".`,
			);
		}

		for (const [index, removal] of (item.removeBy ?? []).entries()) {
			if (!hasItem(removal.itemId)) {
				addIssue(
					ctx,
					[
						"items",
						itemId,
						"removeBy",
						index,
						"itemId",
					],
					`Missing item "${removal.itemId}".`,
				);
			}
		}
	}

	for (const [mergeId, merge] of Object.entries(value.merge)) {
		if (!hasItem(merge.withItemId)) {
			addIssue(
				ctx,
				[
					"merge",
					mergeId,
					"withItemId",
				],
				`Missing item "${merge.withItemId}".`,
			);
		}

		if (!hasItem(merge.resultItemId)) {
			addIssue(
				ctx,
				[
					"merge",
					mergeId,
					"resultItemId",
				],
				`Missing item "${merge.resultItemId}".`,
			);
		}
	}

	for (const [producerId, producer] of Object.entries(value.producers)) {
		for (const [index, productId] of producer.productIds.entries()) {
			if (!hasProduct(productId)) {
				addIssue(
					ctx,
					[
						"producers",
						producerId,
						"productIds",
						index,
					],
					`Missing product "${productId}".`,
				);
			}
		}

		validateItemRequirements(
			ctx,
			[
				"producers",
				producerId,
				"requirements",
			],
			producer.requirements,
			hasItem,
		);
	}

	for (const [stashId, stash] of Object.entries(value.stashes)) {
		if (!hasLootTable(stash.outputTableId)) {
			addIssue(
				ctx,
				[
					"stashes",
					stashId,
					"outputTableId",
				],
				`Missing loot table "${stash.outputTableId}".`,
			);
		}

		validateItemInputs(
			ctx,
			[
				"stashes",
				stashId,
				"inputs",
			],
			stash.inputs,
			hasItem,
		);
		validateItemRequirements(
			ctx,
			[
				"stashes",
				stashId,
				"requirements",
			],
			stash.requirements,
			hasItem,
		);

		if (typeof stash.onDepleted === "object" && !hasItem(stash.onDepleted.replaceWithItemId)) {
			addIssue(
				ctx,
				[
					"stashes",
					stashId,
					"onDepleted",
					"replaceWithItemId",
				],
				`Missing item "${stash.onDepleted.replaceWithItemId}".`,
			);
		}
	}

	for (const [craftRecipeId, recipe] of Object.entries(value.craftRecipes)) {
		if (!hasItem(recipe.resultItemId)) {
			addIssue(
				ctx,
				[
					"craftRecipes",
					craftRecipeId,
					"resultItemId",
				],
				`Missing item "${recipe.resultItemId}".`,
			);
		}

		validateCraftRecipeInputs(
			ctx,
			[
				"craftRecipes",
				craftRecipeId,
				"inputs",
			],
			recipe.inputs,
			hasItem,
		);
		validateItemRequirements(
			ctx,
			[
				"craftRecipes",
				craftRecipeId,
				"requirements",
			],
			recipe.requirements,
			hasItem,
		);
	}

	for (const [lootTableId, lootTable] of Object.entries(value.lootTables)) {
		validateActivationOutput(
			ctx,
			[
				"lootTables",
				lootTableId,
				"output",
			],
			lootTable.output,
			hasItem,
		);
	}

	for (const [productId, product] of Object.entries(value.products)) {
		validateItemInputs(
			ctx,
			[
				"products",
				productId,
				"inputs",
			],
			product.inputs,
			hasItem,
		);
		validateItemRequirements(
			ctx,
			[
				"products",
				productId,
				"requirements",
			],
			product.requirements,
			hasItem,
		);

		if (product.outputTableId && !hasLootTable(product.outputTableId)) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"outputTableId",
				],
				`Missing loot table "${product.outputTableId}".`,
			);
		}
	}

	for (const [upgradeId, upgrade] of Object.entries(value.upgrades)) {
		for (const [tierIndex, tier] of upgrade.tiers.entries()) {
			for (const [costIndex, cost] of tier.cost.entries()) {
				if (!hasItem(cost.itemId)) {
					addIssue(
						ctx,
						[
							"upgrades",
							upgradeId,
							"tiers",
							tierIndex,
							"cost",
							costIndex,
							"itemId",
						],
						`Missing item "${cost.itemId}".`,
					);
				}
			}

			for (const [effectIndex, effect] of tier.effects.entries()) {
				if (!hasProduct(effect.productId)) {
					addIssue(
						ctx,
						[
							"upgrades",
							upgradeId,
							"tiers",
							tierIndex,
							"effects",
							effectIndex,
							"productId",
						],
						`Missing product "${effect.productId}".`,
					);
					continue;
				}

				if (effect.type === "product.outputTable.set" && !hasLootTable(effect.tableId)) {
					addIssue(
						ctx,
						[
							"upgrades",
							upgradeId,
							"tiers",
							tierIndex,
							"effects",
							effectIndex,
							"tableId",
						],
						`Missing loot table "${effect.tableId}".`,
					);
				}

				if (effect.type === "product.input.quantity.add") {
					if (!hasItem(effect.itemId)) {
						addIssue(
							ctx,
							[
								"upgrades",
								upgradeId,
								"tiers",
								tierIndex,
								"effects",
								effectIndex,
								"itemId",
							],
							`Missing item "${effect.itemId}".`,
						);
					}

					const product = value.products[effect.productId];
					if (
						product &&
						!product.inputs.some((input) => input.itemId === effect.itemId)
					) {
						addIssue(
							ctx,
							[
								"upgrades",
								upgradeId,
								"tiers",
								tierIndex,
								"effects",
								effectIndex,
								"itemId",
							],
							`Product "${effect.productId}" has no input "${effect.itemId}".`,
						);
					}
				}
			}
		}
	}

	for (const [index, entry] of value.startingState.inventory.entries()) {
		if (!hasItem(entry.itemId)) {
			addIssue(
				ctx,
				[
					"startingState",
					"inventory",
					index,
					"itemId",
				],
				`Missing item "${entry.itemId}".`,
			);
		}
	}

	for (const [index, entry] of value.startingState.board.entries()) {
		if (!hasItem(entry.itemId)) {
			addIssue(
				ctx,
				[
					"startingState",
					"board",
					index,
					"itemId",
				],
				`Missing item "${entry.itemId}".`,
			);
		}

		if (entry.x >= value.game.board.width) {
			addIssue(
				ctx,
				[
					"startingState",
					"board",
					index,
					"x",
				],
				`x must be < board width (${value.game.board.width}).`,
			);
		}

		if (entry.y >= value.game.board.height) {
			addIssue(
				ctx,
				[
					"startingState",
					"board",
					index,
					"y",
				],
				`y must be < board height (${value.game.board.height}).`,
			);
		}
	}
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type GameConfigFragment = z.infer<typeof GameConfigFragmentSchema>;
export type GameConfigIssuePath = (string | number)[];

export const parseGameConfigFragment = (value: unknown) => GameConfigFragmentSchema.parse(value);
export const parseGameConfig = (value: unknown) => GameConfigSchema.parse(value);

const createRecordGuard = (record: Readonly<Record<string, unknown>>) => (key: string) =>
	Object.hasOwn(record, key);

const addIssue = (ctx: z.RefinementCtx, path: GameConfigIssuePath, message: string) => {
	ctx.addIssue({
		code: "custom",
		path,
		message,
	});
};

const validateItemInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		itemId: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}
	}
};

const validateCraftRecipeInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		itemId: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}
	}
};

const validateItemRequirements = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	requirements: readonly {
		itemId: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	for (const [index, requirement] of requirements.entries()) {
		if (!hasItem(requirement.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${requirement.itemId}".`,
			);
		}
	}
};

const validateActivationOutput = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	output: z.infer<typeof ActivationOutputSchema>,
	hasItem: (itemId: string) => boolean,
) => {
	for (const [index, entry] of output.entries()) {
		if (entry.type === "weighted") {
			for (const [entryIndex, weightedEntry] of entry.entries.entries()) {
				if (!hasItem(weightedEntry.itemId)) {
					addIssue(
						ctx,
						[
							...path,
							index,
							"entries",
							entryIndex,
							"itemId",
						],
						`Missing item "${weightedEntry.itemId}".`,
					);
				}
			}

			continue;
		}

		if (!hasItem(entry.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${entry.itemId}".`,
			);
		}
	}
};
