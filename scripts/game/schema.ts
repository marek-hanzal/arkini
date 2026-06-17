import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

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

const ActivationInputSchema = z
	.array(
		z
			.object({
				itemId: IdSchema,
				quantity: PositiveIntegerSchema,
				capacity: PositiveIntegerSchema,
			})
			.strict(),
	)
	.optional();

const ActivationRequirementSchema = z
	.array(
		z
			.object({
				itemId: IdSchema,
				quantity: PositiveIntegerSchema,
				capacity: PositiveIntegerSchema,
			})
			.strict(),
	)
	.optional();

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
				probability: z.number().min(0).max(1),
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

const MergeRuleSchema = z
	.object({
		withItemId: IdSchema,
		resultItemId: IdSchema,
		consumeSource: z.boolean().optional(),
		inputCount: z.literal(2).optional(),
		secret: z.boolean().optional(),
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
		mergeRuleIds: z.array(IdSchema).optional(),
		producerId: IdSchema.optional(),
		stashId: IdSchema.optional(),
		craftRecipeId: IdSchema.optional(),
	})
	.strict();

const ActivationSharedSchema = z.object({
	trigger: z.literal("click"),
	placement: z.literal("board_then_inventory"),
	outputTableId: IdSchema,
	inputs: ActivationInputSchema,
	requirements: ActivationRequirementSchema,
});

const ProducerDefinitionSchema = ActivationSharedSchema.extend({
	type: z.literal("producer"),
	cooldownMs: NonNegativeIntegerSchema,
}).strict();

const StashDefinitionSchema = ActivationSharedSchema.extend({
	type: z.literal("stash"),
	charges: PositiveIntegerSchema,
	onDepleted: z.union([
		z.literal("remove"),
		z
			.object({
				replaceWithItemId: IdSchema,
			})
			.strict(),
	]),
}).strict();

const CraftRecipeSchema = z
	.object({
		resultItemId: IdSchema,
		inputs: z.array(
			z
				.object({
					itemId: IdSchema,
					quantity: PositiveIntegerSchema,
				})
				.strict(),
		),
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
		output: ActivationOutputSchema.min(1),
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
			type: z.literal("producer.cooldown.add"),
			itemId: IdSchema,
			ms: z.number().int(),
		})
		.strict(),
	z
		.object({
			type: z.literal("producer.outputTable.set"),
			itemId: IdSchema,
			tableId: IdSchema,
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
		resources: z.array(
			z
				.object({
					resourceId: IdSchema,
					quantity: NonNegativeIntegerSchema,
				})
				.strict(),
		),
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

const PartialGamePackageSchema = z
	.object({
		version: z.literal(1).optional(),
		game: GameMetaSchema.optional(),
		resources: z.record(IdSchema, ResourceDefinitionSchema).optional(),
		assets: z.record(IdSchema, AssetDefinitionSchema).optional(),
		items: z.record(IdSchema, ItemDefinitionSchema).optional(),
		mergeRules: z.record(IdSchema, MergeRuleSchema).optional(),
		producers: z.record(IdSchema, ProducerDefinitionSchema).optional(),
		stashes: z.record(IdSchema, StashDefinitionSchema).optional(),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema).optional(),
		products: z.record(IdSchema, ProductDefinitionSchema).optional(),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema).optional(),
		upgrades: z.record(IdSchema, UpgradeDefinitionSchema).optional(),
		startingState: StartingStateDefinitionSchema.optional(),
	})
	.strict();

const BaseGamePackageSchema = z
	.object({
		version: z.literal(1),
		game: GameMetaSchema,
		resources: z.record(IdSchema, ResourceDefinitionSchema),
		assets: z.record(IdSchema, AssetDefinitionSchema),
		items: z.record(IdSchema, ItemDefinitionSchema),
		mergeRules: z.record(IdSchema, MergeRuleSchema),
		producers: z.record(IdSchema, ProducerDefinitionSchema),
		stashes: z.record(IdSchema, StashDefinitionSchema),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema),
		products: z.record(IdSchema, ProductDefinitionSchema),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema),
		upgrades: z.record(IdSchema, UpgradeDefinitionSchema),
		startingState: StartingStateDefinitionSchema,
	})
	.strict();

export const GamePackageSchema = BaseGamePackageSchema.superRefine((value, ctx) => {
	const hasResource = createRecordGuard(value.resources);
	const hasAsset = createRecordGuard(value.assets);
	const hasItem = createRecordGuard(value.items);
	const hasMergeRule = createRecordGuard(value.mergeRules);
	const hasProducer = createRecordGuard(value.producers);
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

		for (const [index, mergeRuleId] of (item.mergeRuleIds ?? []).entries()) {
			if (!hasMergeRule(mergeRuleId)) {
				addIssue(
					ctx,
					[
						"items",
						itemId,
						"mergeRuleIds",
						index,
					],
					`Missing merge rule "${mergeRuleId}".`,
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
	}

	for (const [mergeRuleId, mergeRule] of Object.entries(value.mergeRules)) {
		if (!hasItem(mergeRule.withItemId)) {
			addIssue(
				ctx,
				[
					"mergeRules",
					mergeRuleId,
					"withItemId",
				],
				`Missing item "${mergeRule.withItemId}".`,
			);
		}

		if (!hasItem(mergeRule.resultItemId)) {
			addIssue(
				ctx,
				[
					"mergeRules",
					mergeRuleId,
					"resultItemId",
				],
				`Missing item "${mergeRule.resultItemId}".`,
			);
		}
	}

	for (const [producerId, producer] of Object.entries(value.producers)) {
		validateActivationDefinition(
			ctx,
			[
				"producers",
				producerId,
			],
			producer,
			hasItem,
			hasLootTable,
		);
	}

	for (const [stashId, stash] of Object.entries(value.stashes)) {
		validateActivationDefinition(
			ctx,
			[
				"stashes",
				stashId,
			],
			stash,
			hasItem,
			hasLootTable,
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

		for (const [index, input] of recipe.inputs.entries()) {
			if (!hasItem(input.itemId)) {
				addIssue(
					ctx,
					[
						"craftRecipes",
						craftRecipeId,
						"inputs",
						index,
						"itemId",
					],
					`Missing item "${input.itemId}".`,
				);
			}
		}
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
		validateActivationOutput(
			ctx,
			[
				"products",
				productId,
				"output",
			],
			product.output,
			hasItem,
		);
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
				if (effect.type === "producer.cooldown.add" && !hasItem(effect.itemId)) {
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

				if (effect.type === "producer.outputTable.set") {
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

					if (!hasLootTable(effect.tableId)) {
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

export type GamePackage = z.infer<typeof GamePackageSchema>;
export type GamePackageFragment = z.infer<typeof PartialGamePackageSchema>;
export type GamePackageIssuePath = (string | number)[];

export const parseGamePackageFragment = (value: unknown) => PartialGamePackageSchema.parse(value);
export const parseGamePackage = (value: unknown) => GamePackageSchema.parse(value);

const createRecordGuard = (record: Readonly<Record<string, unknown>>) => (key: string) =>
	Object.hasOwn(record, key);

const addIssue = (ctx: z.RefinementCtx, path: GamePackageIssuePath, message: string) => {
	ctx.addIssue({
		code: "custom",
		path,
		message,
	});
};

const validateActivationDefinition = (
	ctx: z.RefinementCtx,
	path: GamePackageIssuePath,
	value: {
		outputTableId: string;
		inputs?: readonly {
			itemId: string;
		}[];
		requirements?: readonly {
			itemId: string;
		}[];
	},
	hasItem: (itemId: string) => boolean,
	hasLootTable: (lootTableId: string) => boolean,
) => {
	if (!hasLootTable(value.outputTableId)) {
		addIssue(
			ctx,
			[
				...path,
				"outputTableId",
			],
			`Missing loot table "${value.outputTableId}".`,
		);
	}

	for (const [index, input] of (value.inputs ?? []).entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					"inputs",
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}
	}

	for (const [index, requirement] of (value.requirements ?? []).entries()) {
		if (!hasItem(requirement.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					"requirements",
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
	path: GamePackageIssuePath,
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
