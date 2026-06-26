import { z } from "zod";

/**
 * Canonical Arkini v0 game package contract.
 *
 * This file is intentionally owned by the runtime game source, not by the CLI. The
 * local `game:compile` and `game:validate` commands import the same schema that the
 * browser-side loader will eventually use, so JSON authoring feedback and runtime
 * package loading do not drift into two similar-but-different religions. Humanity
 * already tried that with date formats and somehow survived, but we should not test
 * its luck again.
 *
 * `GameConfig` is the compiled, canonical shape consumed by the game engine. Authoring
 * files under `./game/<package>/` may be split into any number of JSON fragments, but
 * after compile/merge the engine must only see this single shape:
 *
 * ```txt
 * resources -> assets -> items -> merge/producers/products/stashes/craft/loot
 * ```
 *
 * The package contains static game truth only. Mutable save state such as occupied
 * board slots, producer line progress, selected default product lines, running craft jobs
 * belong to the save/runtime engine state, not here.
 *
 * Important gameplay contracts represented by this schema:
 *
 * - Board tiles never stack. Produced/crafted/dropped items are placed onto empty board
 *   cells first and then into inventory stacks/slots through `board_then_inventory`.
 * - Inventory may stack items up to each item's `maxStackSize`.
 * - Item `storage` declares where the item may persist: `board`, `inventory`, or
 *   `both`. Missing storage defaults to `both`. Board-only danger tiles can therefore
 *   spawn on the board without letting the player launder the problem through inventory.
 * - Item `maxCount` optionally caps how many copies may exist on the board. Missing
 *   `maxCount` means unlimited, because sometimes restraint should be explicit.
 * - Merge definitions are explicit source-owned rules. If both drag directions should
 *   work, both source items must reference their own rule. The engine must not invent
 *   reverse merges from target-owned rules.
 * - Activation inputs always say whether they are consumed. Product-line/stash/craft
 *   code must not guess this from context, because guessing is just a bug wearing a hat.
 * - Passive requirements always declare their search scope (`board`, `inventory`, or
 *   `board_or_inventory`). They model global knowledge/permission/ownership gates.
 * - Producer/product requirements are referenced through central `requirements` entries by
 *   `requirementIds`. Proximity requirements use Chebyshev grid distance, so radius 1
 *   includes diagonals around the target tile. Producer/product `hinderedBy` entries are
 *   negative production effects: every active hindrance instance may slow the selected product without
 *   preventing start.
 * - Producer `productIds` are ordered production lines. Runtime board-click activation
 *   only uses an explicitly selected default product line. Without a user-selected
 *   default, clicking a producer tile is intentionally a noop. Product
 *   definitions are owned by exactly one producer line. Producer shells do not own
 *   inputs; product lines own their normal `inputs` inline. `inputRefId` remains only
 *   for rare shared/legacy bundles. Runtime may still choose between multiple product lines accepting the same dragged
 *   item by default-line priority, then configured order. `maxQueueSize` is a hard per-producer-instance cap
 *   covering both running and queued jobs.
 * - Product inputs are stored per product line. Craft inputs are stored per craft
 *   target instance until the player explicitly starts the craft. Completion replaces
 *   the target with exactly one result item.
 * - Product lines own their normal `output` inline. `outputTableId` remains only for
 *   rare reusable loot tables. A product without `output` or `outputTableId` is valid.
 *   That is a delayed sink/destructor such as a shredder.
 * - `items.*.removeBy` is a generic board/tile removal rule. It is not producer logic.
 *
 * Minimal source fragment example:
 *
 * ```json
 * {
 *   "items": {
 *     "item:twig": {
 *       "assetId": "asset:twig",
 *       "code": "twig",
 *       "name": "Twig",
 *       "tier": 0,
 *       "maxStackSize": 32,
 *       "description": "A tiny piece of future infrastructure.",
 *       "tags": ["wood"],
 *       "mergeIds": ["merge:twig-to-stick"]
 *     }
 *   },
 *   "merge": {
 *     "merge:twig-to-stick": {
 *       "withItemId": "item:twig",
 *       "resultItemId": "item:stick"
 *     }
 *   },
 *   "requirements": {
 *     "requirement:lumber-camp.near-tree": {
 *       "type": "proximity",
 *       "itemIds": ["item:tree"],
 *       "distance": 1,
 *       "durationFactor": 1
 *     },
 *     "requirement:saw-license": {
 *       "type": "passive",
 *       "itemId": "item:saw-license",
 *       "quantity": 1,
 *       "scope": "board_or_inventory"
 *     }
 *   }
 * }
 * ```
 *
 * Producer line example:
 *
 * ```json
 * {
 *   "producers": {
 *     "producer:lumber-camp": {
 *       "type": "producer",
 *       "maxQueueSize": 1,
 *       "productIds": ["product:lumber-camp.basic", "product:lumber-camp.saw"],
 *       "requirementIds": ["requirement:lumber-camp.near-tree"],
 *       "hinderedBy": [
 *         { "type": "proximity", "itemIds": ["item:pollution"], "distance": 2, "durationFactor": 0.5 }
 *       ]
 *     }
 *   },
 *   "products": {
 *     "product:lumber-camp.saw": {
 *       "name": "Saw logs",
 *       "durationMs": 5000,
 *       "placement": "board_then_inventory",
 *       "inputs": [{ "itemId": "item:log", "quantity": 1, "capacity": 1, "consume": true }],
 *       "requirementIds": ["requirement:saw-license"],
 *       "hinderedBy": [],
 *       "output": [{ "type": "guaranteed", "itemId": "item:plank", "quantity": 1 }]
 *     }
 *   }
 * }
 * ```
 *
 * The schema validates structure and cross-reference integrity. It does not run the
 * economy. The standalone engine should still be tested against this contract by
 * applying actions/ticks to `(config, save)` and asserting emitted events plus resulting
 * save changes. In other words: this file says what the game is allowed to mean; engine
 * tests prove the runtime actually respects it instead of performing interpretive dance.
 */

/** Stable authoring ID. IDs are plain strings so JSON fragments can cross-link by key. */
const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();
const SignedIntegerSchema = z.number().int();
const ProbabilitySchema = z.number().min(0).max(1);
const ProbabilityDeltaSchema = z.number().min(-1).max(1);
/**
 * Output placement policy.
 *
 * Keep this as an enum even while it has one value so runtime code can use exhaustive
 * matching when future placement modes finally arrive to make our lives worse.
 */
const PlacementSchema = z.enum([
	"board_then_inventory",
]);

/** Persistent location policy for item definitions. */
const ItemStoragePolicySchema = z
	.enum([
		"board",
		"inventory",
		"both",
	])
	.default("both");

/** Fixed or ranged output quantity used by loot tables. */
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

/**
 * Input slot for activations that can be gradually filled, currently products/stashes.
 * `consume` is required because config authors must see whether a fed item disappears.
 */
const ItemStackInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		capacity: PositiveIntegerSchema,
		consume: z.boolean(),
	})
	.strict();

/** Craft input slot gradually filled on the concrete craft target before explicit start. */
const CraftRecipeInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		consume: z.boolean(),
	})
	.strict();

/**
 * Stored requirement means the item is placed onto the target capability and gates use.
 * It is not an activation input. Craft consumes stored requirements into its final replacement result.
 */
const StoredItemRequirementSchema = z
	.object({
		type: z.literal("stored"),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		capacity: PositiveIntegerSchema,
	})
	.strict();

/**
 * Passive requirement gates by ownership/presence in an explicit scope. This deliberately
 * avoids spatial rules such as adjacency; those are not part of the current engine DSL.
 */
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

/** Optional shared/legacy product-line input bundle. Normal product inputs live inline on products. */
const ProductInputDefinitionSchema = z
	.object({
		name: z.string().min(1),
		inputs: ActivationInputSchema,
	})
	.strict();

const ActivationRequirementSchema = z.array(
	z.discriminatedUnion("type", [
		StoredItemRequirementSchema,
		PassiveItemRequirementSchema,
	]),
);

/**
 * Proximity requirement gates a producer/product by nearby board items.
 * Distance uses Chebyshev grid radius, so distance 1 includes diagonals.
 * `durationFactor` multiplies the matched resource distance into production time.
 * Missing factor defaults to 1 at runtime.
 */
const ProximityItemRequirementSchema = z
	.object({
		type: z.literal("proximity"),
		itemIds: z.array(IdSchema).min(1),
		distance: PositiveIntegerSchema,
		durationFactor: z.number().min(0).optional(),
	})
	.strict();

/**
 * Negative production hindrance. Hindrances do not gate production. Every active
 * hindrance instance applies a duration penalty, and active penalties stack. Passive
 * hindrances react to item presence in a scope; proximity hindrances react to nearby
 * board items and get stronger when closer.
 */
const PassiveItemHindranceSchema = z
	.object({
		type: z.literal("passive"),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		scope: z.enum([
			"board",
			"inventory",
			"board_or_inventory",
		]),
		durationFactor: z.number().min(0).optional(),
	})
	.strict();

const ProximityItemHindranceSchema = z
	.object({
		type: z.literal("proximity"),
		itemIds: z.array(IdSchema).min(1),
		distance: PositiveIntegerSchema,
		durationFactor: z.number().min(0).optional(),
	})
	.strict();

const GameHindranceDefinitionSchema = z.discriminatedUnion("type", [
	PassiveItemHindranceSchema,
	ProximityItemHindranceSchema,
]);

const GameHindrancesSchema = z.array(GameHindranceDefinitionSchema);

/** Selects which producer product lines an effect operation may touch. */
const GameEffectProductLineTargetSchema = z
	.object({
		all: z.literal(true).optional(),
		producerIds: z.array(IdSchema).min(1).optional(),
		productIds: z.array(IdSchema).min(1).optional(),
		producerTagsAny: z.array(z.string().min(1)).min(1).optional(),
		producerTagsAll: z.array(z.string().min(1)).min(1).optional(),
		productTagsAny: z.array(z.string().min(1)).min(1).optional(),
		productTagsAll: z.array(z.string().min(1)).min(1).optional(),
	})
	.strict();

/** Selects which item definitions an effect operation may touch. */
const GameEffectItemTargetSchema = z
	.object({
		all: z.literal(true).optional(),
		itemIds: z.array(IdSchema).min(1).optional(),
		itemTagsAny: z.array(z.string().min(1)).min(1).optional(),
		itemTagsAll: z.array(z.string().min(1)).min(1).optional(),
	})
	.strict();

const GameEffectProductLineOperationBaseSchema = {
	target: GameEffectProductLineTargetSchema,
};

const GameEffectItemOperationBaseSchema = {
	target: GameEffectItemTargetSchema,
};

/** Runtime-only product-line and loot mutator operation. */
const GameEffectOperationSchema = z.discriminatedUnion("kind", [
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("line.reveal"),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("line.hide"),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("line.blockStart"),
			reason: z.string().min(1).optional(),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("duration.addMs"),
			valueMs: SignedIntegerSchema,
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("duration.multiply"),
			multiplier: z.number().min(0),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.appendTable"),
			lootTableId: IdSchema,
			chance: ProbabilitySchema.optional(),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.replaceTable"),
			lootTableId: IdSchema,
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.addChanceItem"),
			itemId: IdSchema,
			chance: ProbabilitySchema,
			quantity: QuantitySchema.optional(),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.dropChance.add"),
			delta: ProbabilityDeltaSchema,
		})
		.strict(),
	z
		.object({
			...GameEffectItemOperationBaseSchema,
			kind: z.literal("item.blockCreate"),
			reason: z.string().min(1).optional(),
		})
		.strict(),
]);

const GameEffectSourceScopeSchema = z.enum([
	"board",
	"inventory",
	"both",
]);

const GameEffectCommonDefinitionFieldsSchema = {
	name: z.string().min(1),
	operations: z.array(GameEffectOperationSchema).min(1),
	sourceScope: GameEffectSourceScopeSchema.optional(),
};

/** Runtime mutator definition. Effects never mutate GameConfig; they shape runtime views. */
const GameEffectDefinitionSchema = z.discriminatedUnion("scope", [
	z
		.object({
			...GameEffectCommonDefinitionFieldsSchema,
			scope: z.literal("global"),
		})
		.strict(),
	z
		.object({
			...GameEffectCommonDefinitionFieldsSchema,
			scope: z.literal("local"),
			radius: PositiveIntegerSchema,
		})
		.strict(),
]);

/** Central reusable requirement table entry referenced by producer/product requirementIds. */
const GameRequirementDefinitionSchema = z.discriminatedUnion("type", [
	StoredItemRequirementSchema,
	PassiveItemRequirementSchema,
	ProximityItemRequirementSchema,
]);

/**
 * Loot output model.
 *
 * `guaranteed` always emits, `chance` is an independent probability roll, and
 * `weighted` chooses from weighted entries for the configured number of rolls.
 */
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

/** Package-level board/inventory dimensions and human-readable title. */
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

/** Generated base64 resource payload, usually from PNG files under `game/<id>/assets`. */
const ResourceDefinitionSchema = z
	.object({
		data: z.string().min(1),
	})
	.strict();

/** Render-facing asset metadata that maps game definitions to generated resources. */
const AssetDefinitionSchema = z
	.object({
		kind: z.enum([
			"item",
			"ui",
		]),
		label: z.string().min(1).optional(),
		resourceId: IdSchema,
		overlayAssetId: IdSchema.optional(),
		render: z
			.enum([
				"plain",
				"blueprint",
			])
			.optional(),
	})
	.strict();

/** Explicit source-owned two-item merge option referenced from `items.*.mergeIds`. */
const MergeDefinitionSchema = z
	.object({
		withItemId: IdSchema,
		resultItemId: IdSchema,
		secret: z.boolean().optional(),
	})
	.strict();

/** Generic tile removal tool rule. `keep` returns the tool; `consume` destroys it. */
const RemoveByDefinitionSchema = z
	.object({
		itemId: IdSchema,
		mode: z.enum([
			"keep",
			"consume",
		]),
	})
	.strict();

/**
 * Core tile/item definition.
 *
 * An item may be plain merge content, a producer tile, stash/container tile, craft
 * blueprint, removable obstacle, tool, currency-like stackable object, or any tasteful
 * combination the future economy decides to inflict on us.
 */
const ItemDefinitionSchema = z
	.object({
		assetId: IdSchema,
		code: z.string().min(1),
		name: z.string().min(1),
		tier: NonNegativeIntegerSchema,
		maxStackSize: PositiveIntegerSchema,
		maxCount: PositiveIntegerSchema.optional(),
		storage: ItemStoragePolicySchema,
		description: z.string(),
		label: z.string().optional(),
		tags: z.array(z.string().min(1)),
		mergeIds: z.array(IdSchema).optional(),
		producerId: IdSchema.optional(),
		stashId: IdSchema.optional(),
		craftRecipeId: IdSchema.optional(),
		passiveEffectIds: z.array(IdSchema).optional(),
		removeBy: z.array(RemoveByDefinitionSchema).optional(),
	})
	.strict();

/** Producer shell with ordered product lines and producer-level requirements. Inputs live on product lines. */
const ProducerDefinitionSchema = z
	.object({
		type: z.literal("producer"),
		maxQueueSize: PositiveIntegerSchema,
		productIds: z.array(IdSchema).min(1),
		requirementIds: z.array(IdSchema),
		hinderedBy: GameHindrancesSchema.optional(),
	})
	.strict();

/** Click/open container that may consume inputs, check requirements and emit loot charges. */
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

/**
 * Delayed recipe outside two-item merge.
 *
 * Inputs are gradually stored on the concrete target before explicit start. Completion
 * replaces the target item in-place with exactly one result item.
 */
const CraftRecipeSchema = z
	.object({
		resultItemId: IdSchema,
		inputs: z.array(CraftRecipeInputSchema),
		requirements: ActivationRequirementSchema,
		durationMs: NonNegativeIntegerSchema,
	})
	.strict();

/** Reusable output table referenced by stashes/effects and rare shared product outputs. */
const LootTableDefinitionSchema = z
	.object({
		name: z.string().min(1),
		output: ActivationOutputSchema.min(1),
	})
	.strict();

/**
 * Producer product line.
 *
 * Missing `output` and `outputTableId` means a valid delayed sink/destructor product.
 * `visibility: "hidden"` makes the line hidden until an effect reveals it.
 */
const ProductDefinitionSchema = z
	.object({
		name: z.string().min(1),
		tags: z.array(z.string().min(1)).default([]),
		visibility: z
			.enum([
				"visible",
				"hidden",
			])
			.default("visible"),
		durationMs: PositiveIntegerSchema,
		placement: PlacementSchema,
		inputs: ActivationInputSchema.optional(),
		inputRefId: IdSchema.optional(),
		requirementIds: z.array(IdSchema),
		hinderedBy: GameHindrancesSchema.optional(),
		output: ActivationOutputSchema.min(1).optional(),
		outputTableId: IdSchema.optional(),
		activatesEffectId: IdSchema.optional(),
	})
	.strict();

/** New-game seed. Board entries are individual tiles; inventory entries may stack. */
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

/**
 * Authoring fragment shape. Any source JSON may contain any subset of these sections;
 * the CLI merges fragments into `BaseGameConfigSchema` before full validation.
 */
const GameConfigFragmentSchema = z
	.object({
		version: z.literal(1).optional(),
		game: GameMetaSchema.optional(),
		resources: z.record(IdSchema, ResourceDefinitionSchema).optional(),
		assets: z.record(IdSchema, AssetDefinitionSchema).optional(),
		items: z.record(IdSchema, ItemDefinitionSchema).optional(),
		merge: z.record(IdSchema, MergeDefinitionSchema).optional(),
		inputs: z.record(IdSchema, ProductInputDefinitionSchema).optional(),
		requirements: z.record(IdSchema, GameRequirementDefinitionSchema).optional(),
		effects: z.record(IdSchema, GameEffectDefinitionSchema).optional(),
		producers: z.record(IdSchema, ProducerDefinitionSchema).optional(),
		stashes: z.record(IdSchema, StashDefinitionSchema).optional(),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema).optional(),
		products: z.record(IdSchema, ProductDefinitionSchema).optional(),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema).optional(),
		startingState: StartingStateDefinitionSchema.optional(),
	})
	.strict();

/** Fully compiled canonical package shape before cross-reference validation. */
const BaseGameConfigSchema = z
	.object({
		version: z.literal(1),
		game: GameMetaSchema,
		resources: z.record(IdSchema, ResourceDefinitionSchema),
		assets: z.record(IdSchema, AssetDefinitionSchema),
		items: z.record(IdSchema, ItemDefinitionSchema),
		merge: z.record(IdSchema, MergeDefinitionSchema),
		inputs: z.record(IdSchema, ProductInputDefinitionSchema),
		requirements: z.record(IdSchema, GameRequirementDefinitionSchema),
		effects: z.record(IdSchema, GameEffectDefinitionSchema).default({}),
		producers: z.record(IdSchema, ProducerDefinitionSchema),
		stashes: z.record(IdSchema, StashDefinitionSchema),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema),
		products: z.record(IdSchema, ProductDefinitionSchema),
		lootTables: z.record(IdSchema, LootTableDefinitionSchema),
		startingState: StartingStateDefinitionSchema,
	})
	.strict();

/**
 * Canonical config parser with cross-reference validation.
 *
 * Structural Zod validation catches malformed sections. This refinement catches the
 * problems that actually ruin content work: missing referenced items/assets/resources,
 * broken product/loot links, invalid starting board coordinates and broken product-line ownership.
 */
export const GameConfigSchema = BaseGameConfigSchema.superRefine((value, ctx) => {
	const hasResource = createRecordGuard(value.resources);
	const hasAsset = createRecordGuard(value.assets);
	const hasItem = createRecordGuard(value.items);
	const hasMerge = createRecordGuard(value.merge);
	const hasInput = createRecordGuard(value.inputs);
	const hasRequirement = createRecordGuard(value.requirements);
	const hasEffect = createRecordGuard(value.effects);
	const hasProducer = createRecordGuard(value.producers);
	const hasProduct = createRecordGuard(value.products);
	const hasStash = createRecordGuard(value.stashes);
	const hasCraftRecipe = createRecordGuard(value.craftRecipes);
	const hasLootTable = createRecordGuard(value.lootTables);

	validateUniqueRecordField(
		ctx,
		[
			"items",
		],
		value.items,
		"code",
		(value) => `Duplicate item code "${value}".`,
	);
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
		const itemAsset = value.assets[item.assetId];
		if (!itemAsset) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"assetId",
				],
				`Missing asset "${item.assetId}".`,
			);
		} else if (itemAsset.kind !== "item") {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"assetId",
				],
				`Item asset "${item.assetId}" must have kind "item".`,
			);
		}

		validateUniqueStringList(
			ctx,
			[
				"items",
				itemId,
				"mergeIds",
			],
			item.mergeIds ?? [],
			(value) => `Duplicate merge "${value}".`,
		);
		validateUniqueStringList(
			ctx,
			[
				"items",
				itemId,
				"tags",
			],
			item.tags,
			(value) => `Duplicate tag "${value}".`,
		);
		validateUniqueStringList(
			ctx,
			[
				"items",
				itemId,
				"passiveEffectIds",
			],
			item.passiveEffectIds ?? [],
			(value) => `Duplicate passive effect "${value}".`,
		);

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

		for (const [index, effectId] of (item.passiveEffectIds ?? []).entries()) {
			if (!hasEffect(effectId)) {
				addIssue(
					ctx,
					[
						"items",
						itemId,
						"passiveEffectIds",
						index,
					],
					`Missing effect "${effectId}".`,
				);
			}
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

	for (const [inputId, inputDefinition] of Object.entries(value.inputs)) {
		validateItemInputs(
			ctx,
			[
				"inputs",
				inputId,
				"inputs",
			],
			inputDefinition.inputs,
			hasItem,
		);
	}

	for (const [requirementId, requirement] of Object.entries(value.requirements)) {
		validateGameRequirement(
			ctx,
			[
				"requirements",
				requirementId,
			],
			requirement,
			hasItem,
		);
	}

	for (const [effectId, effect] of Object.entries(value.effects)) {
		if (
			effect.scope === "local" &&
			(effect.sourceScope === "inventory" || effect.sourceScope === "both")
		) {
			addIssue(
				ctx,
				[
					"effects",
					effectId,
					"sourceScope",
				],
				`Local effect "${effectId}" must use board source scope because inventory sources have no board cell.`,
			);
		}

		for (const [operationIndex, operation] of effect.operations.entries()) {
			const targetPath: GameConfigIssuePath = [
				"effects",
				effectId,
				"operations",
				operationIndex,
				"target",
			];
			if (operation.kind === "item.blockCreate") {
				validateGameEffectItemTarget(ctx, targetPath, operation.target, hasItem);
			} else {
				validateGameEffectProductLineTarget(
					ctx,
					targetPath,
					operation.target,
					hasProducer,
					hasProduct,
				);
			}

			if (
				(operation.kind === "loot.appendTable" || operation.kind === "loot.replaceTable") &&
				!hasLootTable(operation.lootTableId)
			) {
				addIssue(
					ctx,
					[
						"effects",
						effectId,
						"operations",
						operationIndex,
						"lootTableId",
					],
					`Missing loot table "${operation.lootTableId}".`,
				);
			}

			if (operation.kind === "loot.addChanceItem" && !hasItem(operation.itemId)) {
				addIssue(
					ctx,
					[
						"effects",
						effectId,
						"operations",
						operationIndex,
						"itemId",
					],
					`Missing item "${operation.itemId}".`,
				);
			}
		}
	}

	for (const [producerId, producer] of Object.entries(value.producers)) {
		validateUniqueStringList(
			ctx,
			[
				"producers",
				producerId,
				"productIds",
			],
			producer.productIds,
			(value) => `Duplicate product "${value}".`,
		);

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

		validateRequirementIds(
			ctx,
			[
				"producers",
				producerId,
				"requirementIds",
			],
			producer.requirementIds,
			hasRequirement,
		);
		validateGameHindrances(
			ctx,
			[
				"producers",
				producerId,
				"hinderedBy",
			],
			producer.hinderedBy ?? [],
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
		if (product.inputRefId && !hasInput(product.inputRefId)) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"inputRefId",
				],
				`Missing input "${product.inputRefId}".`,
			);
		}
		if (product.inputs) {
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
		}

		if (product.inputRefId && product.inputs) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"inputs",
				],
				"Product lines must not define both inputs and inputRefId.",
			);
		}
		validateRequirementIds(
			ctx,
			[
				"products",
				productId,
				"requirementIds",
			],
			product.requirementIds,
			hasRequirement,
		);
		validateGameHindrances(
			ctx,
			[
				"products",
				productId,
				"hinderedBy",
			],
			product.hinderedBy ?? [],
			hasItem,
		);

		validateUniqueStringList(
			ctx,
			[
				"products",
				productId,
				"tags",
			],
			product.tags,
			(value) => `Duplicate tag "${value}".`,
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
		if (product.output) {
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

		if (product.outputTableId && product.output) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"output",
				],
				"Product lines must not define both output and outputTableId.",
			);
		}

		if (product.activatesEffectId && !hasEffect(product.activatesEffectId)) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"activatesEffectId",
				],
				`Missing effect "${product.activatesEffectId}".`,
			);
		}

		if (product.activatesEffectId && (product.outputTableId || product.output)) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"activatesEffectId",
				],
				"Active effect product lines must not also define output or outputTableId.",
			);
		}
	}

	validateProductLineOwnership(ctx, value);
	if (value.startingState.inventory.length > value.game.inventory.slots) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
			],
			`Starting inventory has ${value.startingState.inventory.length} stacks but only ${value.game.inventory.slots} slots are configured.`,
		);
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
			continue;
		}

		const item = value.items[entry.itemId];
		if (item?.storage === "board") {
			addIssue(
				ctx,
				[
					"startingState",
					"inventory",
					index,
					"itemId",
				],
				`Item "${entry.itemId}" storage policy forbids inventory placement.`,
			);
		}

		if (item && entry.quantity > item.maxStackSize) {
			addIssue(
				ctx,
				[
					"startingState",
					"inventory",
					index,
					"quantity",
				],
				`Quantity must be <= item maxStackSize (${item.maxStackSize}).`,
			);
		}
	}

	const usedStartingBoardCells = new Set<string>();
	const startingBoardItemCountByItemId = new Map<string, number>();
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
		} else if (value.items[entry.itemId]?.storage === "inventory") {
			addIssue(
				ctx,
				[
					"startingState",
					"board",
					index,
					"itemId",
				],
				`Item "${entry.itemId}" storage policy forbids board placement.`,
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

		startingBoardItemCountByItemId.set(
			entry.itemId,
			(startingBoardItemCountByItemId.get(entry.itemId) ?? 0) + 1,
		);

		const cellKey = `${entry.x}:${entry.y}`;
		if (usedStartingBoardCells.has(cellKey)) {
			addIssue(
				ctx,
				[
					"startingState",
					"board",
					index,
				],
				`Duplicate starting board cell (${entry.x}, ${entry.y}).`,
			);
		}
		usedStartingBoardCells.add(cellKey);
	}

	for (const [itemId, quantity] of startingBoardItemCountByItemId) {
		const maxCount = value.items[itemId]?.maxCount;
		if (maxCount === undefined || quantity <= maxCount) continue;

		addIssue(
			ctx,
			[
				"startingState",
				"board",
			],
			`Starting board has ${quantity} item(s) of "${itemId}" but maxCount is ${maxCount}.`,
		);
	}
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type GameConfigFragment = z.infer<typeof GameConfigFragmentSchema>;
export type GameConfigIssuePath = (string | number)[];

/** Parse one authoring fragment before merge. */
export const parseGameConfigFragment = (value: unknown) => GameConfigFragmentSchema.parse(value);
/** Parse and fully validate the compiled canonical package. */
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

const validateUniqueStringList = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	values: readonly string[],
	createMessage: (value: string) => string,
) => {
	const firstIndexByValue = new Map<string, number>();

	for (const [index, value] of values.entries()) {
		const firstIndex = firstIndexByValue.get(value);
		if (firstIndex !== undefined) {
			addIssue(
				ctx,
				[
					...path,
					index,
				],
				createMessage(value),
			);
			continue;
		}

		firstIndexByValue.set(value, index);
	}
};

const validateUniqueRecordField = <
	RecordValue extends Readonly<Record<string, unknown>>,
	Field extends keyof RecordValue,
>(
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	record: Readonly<Record<string, RecordValue>>,
	field: Field,
	createMessage: (value: string) => string,
) => {
	const ownerIdByValue = new Map<string, string>();

	for (const [entryId, entry] of Object.entries(record)) {
		const value = entry[field];
		if (typeof value !== "string") {
			continue;
		}

		const previousOwnerId = ownerIdByValue.get(value);
		if (previousOwnerId) {
			addIssue(
				ctx,
				[
					...path,
					entryId,
					field as string,
				],
				`${createMessage(value)} First used by "${previousOwnerId}".`,
			);
			continue;
		}

		ownerIdByValue.set(value, entryId);
	}
};

const validateProductLineOwnership = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	const ownerByProductId = new Map<string, string>();

	for (const [producerId, producer] of Object.entries(config.producers)) {
		for (const [productIndex, productId] of producer.productIds.entries()) {
			const previousProducerId = ownerByProductId.get(productId);
			if (previousProducerId) {
				addIssue(
					ctx,
					[
						"producers",
						producerId,
						"productIds",
						productIndex,
					],
					`Product "${productId}" must be owned by exactly one producer. First used by "${previousProducerId}".`,
				);
				continue;
			}

			ownerByProductId.set(productId, producerId);
		}
	}

	validateProductInputRefOwnership(
		ctx,
		[
			"products",
		],
		Object.fromEntries(
			Object.entries(config.products).flatMap(([productId, product]) =>
				product.inputRefId
					? [
							[
								productId,
								product.inputRefId,
							],
						]
					: [],
			),
		),
	);
};

const validateProductInputRefOwnership = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputRefIdByProductId: Readonly<Record<string, string>>,
) => {
	const productIdByInputRefId = new Map<string, string>();

	for (const [productId, inputRefId] of Object.entries(inputRefIdByProductId)) {
		const previousProductId = productIdByInputRefId.get(inputRefId);
		if (previousProductId) {
			addIssue(
				ctx,
				[
					...path,
					productId,
					"inputRefId",
				],
				`Input ref "${inputRefId}" must be owned by exactly one product line. First used by "${previousProductId}".`,
			);
			continue;
		}

		productIdByInputRefId.set(inputRefId, productId);
	}
};

const validateItemInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		capacity: number;
		itemId: string;
		quantity: number;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate input item "${value}".`,
	);

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

		if (input.capacity < input.quantity) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"capacity",
				],
				`Capacity must be >= quantity (${input.quantity}).`,
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
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate craft input item "${value}".`,
	);

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

const validateRequirementIds = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	requirementIds: readonly string[],
	hasRequirement: (requirementId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		requirementIds,
		(value) => `Duplicate requirement id "${value}".`,
	);

	for (const [index, requirementId] of requirementIds.entries()) {
		if (!hasRequirement(requirementId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
				],
				`Missing requirement "${requirementId}".`,
			);
		}
	}
};

const validateGameEffectProductLineTarget = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	target: z.infer<typeof GameEffectProductLineTargetSchema>,
	hasProducer: (producerId: string) => boolean,
	hasProduct: (productId: string) => boolean,
) => {
	const selectorFieldNames = [
		"producerIds",
		"productIds",
		"producerTagsAny",
		"producerTagsAll",
		"productTagsAny",
		"productTagsAll",
	] as const;
	const selectorCount = selectorFieldNames.filter((fieldName) => target[fieldName]).length;
	if (!target.all && selectorCount === 0) {
		addIssue(
			ctx,
			path,
			`Effect target must define at least one selector or explicit all: true.`,
		);
	}
	if (target.all && selectorCount > 0) {
		addIssue(ctx, path, `Effect target all: true must not be combined with selectors.`);
	}

	const targetLists = [
		[
			"producerIds",
			target.producerIds ?? [],
			(value: string) => `Duplicate producer "${value}".`,
		] as const,
		[
			"productIds",
			target.productIds ?? [],
			(value: string) => `Duplicate product "${value}".`,
		] as const,
		[
			"producerTagsAny",
			target.producerTagsAny ?? [],
			(value: string) => `Duplicate producer tag "${value}".`,
		] as const,
		[
			"producerTagsAll",
			target.producerTagsAll ?? [],
			(value: string) => `Duplicate producer tag "${value}".`,
		] as const,
		[
			"productTagsAny",
			target.productTagsAny ?? [],
			(value: string) => `Duplicate product tag "${value}".`,
		] as const,
		[
			"productTagsAll",
			target.productTagsAll ?? [],
			(value: string) => `Duplicate product tag "${value}".`,
		] as const,
	];

	for (const [field, values, createMessage] of targetLists) {
		validateUniqueStringList(
			ctx,
			[
				...path,
				field,
			],
			values,
			createMessage,
		);
	}

	for (const [index, producerId] of (target.producerIds ?? []).entries()) {
		if (!hasProducer(producerId)) {
			addIssue(
				ctx,
				[
					...path,
					"producerIds",
					index,
				],
				`Missing producer "${producerId}".`,
			);
		}
	}

	for (const [index, productId] of (target.productIds ?? []).entries()) {
		if (!hasProduct(productId)) {
			addIssue(
				ctx,
				[
					...path,
					"productIds",
					index,
				],
				`Missing product "${productId}".`,
			);
		}
	}
};

const validateGameEffectItemTarget = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	target: z.infer<typeof GameEffectItemTargetSchema>,
	hasItem: (itemId: string) => boolean,
) => {
	const selectorFieldNames = [
		"itemIds",
		"itemTagsAny",
		"itemTagsAll",
	] as const;
	const selectorCount = selectorFieldNames.filter((fieldName) => target[fieldName]).length;
	if (!target.all && selectorCount === 0) {
		addIssue(
			ctx,
			path,
			`Effect target must define at least one selector or explicit all: true.`,
		);
	}
	if (target.all && selectorCount > 0) {
		addIssue(ctx, path, `Effect target all: true must not be combined with selectors.`);
	}

	const targetLists = [
		[
			"itemIds",
			target.itemIds ?? [],
			(value: string) => `Duplicate item "${value}".`,
		] as const,
		[
			"itemTagsAny",
			target.itemTagsAny ?? [],
			(value: string) => `Duplicate item tag "${value}".`,
		] as const,
		[
			"itemTagsAll",
			target.itemTagsAll ?? [],
			(value: string) => `Duplicate item tag "${value}".`,
		] as const,
	];

	for (const [field, values, createMessage] of targetLists) {
		validateUniqueStringList(
			ctx,
			[
				...path,
				field,
			],
			values,
			createMessage,
		);
	}

	for (const [index, itemId] of (target.itemIds ?? []).entries()) {
		if (!hasItem(itemId)) {
			addIssue(
				ctx,
				[
					...path,
					"itemIds",
					index,
				],
				`Missing item "${itemId}".`,
			);
		}
	}
};

const validateItemIds = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	itemIds: readonly string[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(ctx, path, itemIds, (value) => `Duplicate item "${value}".`);

	for (const [index, itemId] of itemIds.entries()) {
		if (!hasItem(itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
				],
				`Missing item "${itemId}".`,
			);
		}
	}
};

const validateGameRequirement = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	requirement: z.infer<typeof GameRequirementDefinitionSchema>,
	hasItem: (itemId: string) => boolean,
) => {
	if (requirement.type === "proximity") {
		validateUniqueStringList(
			ctx,
			[
				...path,
				"itemIds",
			],
			requirement.itemIds,
			(value) => `Duplicate proximity item "${value}".`,
		);

		for (const [index, itemId] of requirement.itemIds.entries()) {
			if (!hasItem(itemId)) {
				addIssue(
					ctx,
					[
						...path,
						"itemIds",
						index,
					],
					`Missing item "${itemId}".`,
				);
			}
		}
		return;
	}

	validateItemRequirements(
		ctx,
		path,
		[
			requirement,
		],
		hasItem,
	);
};

const validateItemRequirements = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	requirements: readonly {
		capacity?: number;
		itemId: string;
		quantity: number;
		scope?: string;
		type: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		requirements.map((requirement) =>
			requirement.type === "passive"
				? `${requirement.type}:${requirement.itemId}:${requirement.scope}`
				: `${requirement.type}:${requirement.itemId}`,
		),
		(value) => `Duplicate requirement "${value}".`,
	);

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

		if (
			requirement.type === "stored" &&
			typeof requirement.capacity === "number" &&
			requirement.capacity < requirement.quantity
		) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"capacity",
				],
				`Capacity must be >= quantity (${requirement.quantity}).`,
			);
		}
	}
};

const validateGameHindrances = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	hindrances: readonly z.infer<typeof GameHindranceDefinitionSchema>[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		hindrances.map((hindrance) =>
			hindrance.type === "passive"
				? `${hindrance.type}:${hindrance.itemId}:${hindrance.scope}`
				: `${hindrance.type}:${hindrance.itemIds.join("|")}:${hindrance.distance}`,
		),
		(value) => `Duplicate hindrance "${value}".`,
	);

	for (const [index, hindrance] of hindrances.entries()) {
		if (hindrance.type === "passive") {
			if (!hasItem(hindrance.itemId)) {
				addIssue(
					ctx,
					[
						...path,
						index,
						"itemId",
					],
					`Missing item "${hindrance.itemId}".`,
				);
			}
			continue;
		}

		validateUniqueStringList(
			ctx,
			[
				...path,
				index,
				"itemIds",
			],
			hindrance.itemIds,
			(value) => `Duplicate hindrance item "${value}".`,
		);

		for (const [itemIndex, itemId] of hindrance.itemIds.entries()) {
			if (!hasItem(itemId)) {
				addIssue(
					ctx,
					[
						...path,
						index,
						"itemIds",
						itemIndex,
					],
					`Missing item "${itemId}".`,
				);
			}
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
