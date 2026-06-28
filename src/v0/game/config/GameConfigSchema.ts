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
 * resources -> assets -> items -> merge/producers/products/stashes/craft/effects
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
 *   code must not guess consumption from context, because guessing is just a bug wearing a hat. Input quantity defaults to 1.
 * - Passive requirements always declare their search scope (`board`, `inventory`, or
 *   `board_or_inventory`). They model global knowledge/permission/ownership gates.
 * - Producer/product requirements are referenced through central `requirements` entries by
 *   `requirementIds`. Proximity requirements use Chebyshev grid distance, so radius 1
 *   includes diagonals around the target tile. Producer/product `hinderedBy` entries are
 *   negative production effects: every active hindrance instance may slow the selected product without
 *   preventing start.
 * - Producer/stash `productIds` are ordered production lines. Runtime board-click activation
 *   only uses an explicitly selected default product line. Without a user-selected
 *   default, clicking a producer tile is intentionally a noop. Product
 *   definitions are owned by exactly one producer line. Producer shells do not own
 *   inputs. Runtime may still choose between multiple product lines accepting the same dragged
 *   item by default-line priority, then configured order. `maxQueueSize` is a hard per-capability-instance cap
 *   covering both running and queued jobs. Optional `charges` live on the producer capability,
 *   product lines spend `chargeCost`, and `onChargesDepleted` decides whether depletion stops
 *   future starts or removes the tile.
 * - Product inputs are stored per product line. Craft inputs are stored per craft
 *   target instance until the player explicitly starts the craft. Completion replaces
 *   the target with exactly one result item.
 * - Product lines own their normal `output` inline and may spend producer charges with `chargeCost`. A product without `output` is valid.
 *   That is a delayed sink/destructor such as a shredder.
 * - `items.*.removeBy` is a generic board/tile removal rule. It is not producer logic.
 *
 * Minimal source fragment example:
 *
 * ```json
 * {
 *   "items": {
 *     "item:twig": {
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
const NonNegativeNumberSchema = z.number().min(0);
const PositiveNumberSchema = z.number().positive();
const SignedIntegerSchema = z.number().int();
const ProbabilitySchema = z.number().min(0).max(1);
const ProbabilityDeltaSchema = z.number().min(-1).max(1);
/**
 * Output placement policy.
 *
 * Keep this as an enum even while it has one value so runtime code can use exhaustive
 * matching when future placement modes finally arrive to make our lives worse.
 */
const PlacementSchema = z
	.enum([
		"board_then_inventory",
	])
	.default("board_then_inventory");

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
 * Input slot for activations that can be gradually filled by product lines.
 * `consume` is required because config authors must see whether a fed item disappears. Missing quantity defaults to 1 because needing one item is the boring common case, not a revelation.
 */
const ItemStackInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema.default(1),
		capacity: PositiveIntegerSchema,
		consume: z.boolean(),
	})
	.strict();

/** Craft input slot gradually filled on the concrete craft target before explicit start. */
const CraftRecipeInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema.default(1),
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

/** Passive requirement gates by ownership/presence in an explicit scope. */
const PassiveItemScopeSchema = z.enum([
	"board",
	"inventory",
	"board_or_inventory",
]);

const PassiveItemRequirementSchema = z
	.object({
		type: z.literal("passive"),
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		scope: PassiveItemScopeSchema,
	})
	.strict();

const ActivationInputSchema = z.array(ItemStackInputSchema);

/**
 * Proximity requirement gates an activation by nearby board items.
 * Distance uses Chebyshev grid radius, so distance 1 includes diagonals.
 * `durationFactor` multiplies the matched resource distance into runtime duration.
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

const ActivationRequirementSchema = z.array(
	z.discriminatedUnion("type", [
		StoredItemRequirementSchema,
		PassiveItemRequirementSchema,
		ProximityItemRequirementSchema,
	]),
);

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
				quantity: QuantitySchema.default(1),
			})
			.strict(),
		z
			.object({
				type: z.literal("chance"),
				itemId: IdSchema,
				chance: z.number().min(0).max(1),
				quantity: QuantitySchema.default(1),
			})
			.strict(),
		z
			.object({
				type: z.literal("weighted"),
				rolls: QuantitySchema.default(1),
				entries: z
					.array(
						z
							.object({
								itemId: IdSchema,
								weight: PositiveIntegerSchema,
								quantity: QuantitySchema.default(1),
							})
							.strict(),
					)
					.min(1),
			})
			.strict(),
	]),
);

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
			kind: z.literal("loot.appendOutput"),
			output: ActivationOutputSchema.min(1),
			chance: ProbabilitySchema.optional(),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.replaceOutput"),
			output: ActivationOutputSchema.min(1),
		})
		.strict(),
	z
		.object({
			...GameEffectProductLineOperationBaseSchema,
			kind: z.literal("loot.addChanceItem"),
			itemId: IdSchema,
			chance: ProbabilitySchema,
			quantity: QuantitySchema.default(1),
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
		kind: z
			.enum([
				"item",
				"ui",
			])
			.default("item"),
		label: z.string().min(1).optional(),
		resourceId: IdSchema,
		overlayAssetId: IdSchema.optional(),
		render: z
			.enum([
				"plain",
				"blueprint",
			])
			.default("plain"),
	})
	.strict();

const AssetDefinitionFragmentSchema = AssetDefinitionSchema.extend({
	resourceId: IdSchema.optional(),
});

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
		name: z.string().min(1),
		tier: NonNegativeIntegerSchema.default(0),
		maxStackSize: PositiveIntegerSchema.default(10),
		maxCount: PositiveIntegerSchema.optional(),
		storage: ItemStoragePolicySchema,
		description: z.string(),
		label: z.string().optional(),
		tags: z.array(z.string().min(1)).default([]),
		mergeIds: z.array(IdSchema).optional(),
		passiveEffectIds: z.array(IdSchema).optional(),
		removeBy: z.array(RemoveByDefinitionSchema).optional(),
	})
	.strict();

const ItemDefinitionFragmentSchema = ItemDefinitionSchema.extend({
	assetId: IdSchema.optional(),
});

const ProducerDepletedModeSchema = z.enum([
	"stop",
	"remove",
]);

/** Producer-like capability with ordered product lines and capability-level requirements. Inputs live on product lines. */
const ProducerDefinitionSchema = z
	.object({
		maxQueueSize: PositiveIntegerSchema.default(1),
		productIds: z.array(IdSchema).min(1),
		requirementIds: z.array(IdSchema).default([]),
		hinderedBy: GameHindrancesSchema.optional(),
		charges: PositiveNumberSchema.optional(),
		onChargesDepleted: ProducerDepletedModeSchema.default("stop"),
	})
	.strict();

/** Stash is a producer-like shell with exactly one product line and finite charges. */
const StashDefinitionSchema = ProducerDefinitionSchema.extend({
	productIds: z.array(IdSchema).length(1),
	charges: PositiveNumberSchema.default(1),
	onChargesDepleted: ProducerDepletedModeSchema.default("remove"),
})
	.strict()
	.superRefine((stash, ctx) => {
		if (stash.onChargesDepleted !== "remove") {
			ctx.addIssue({
				code: "custom",
				message: "Stashes must remove themselves when charges are depleted.",
				path: [
					"onChargesDepleted",
				],
			});
		}
	});

/**
 * Delayed recipe outside two-item merge.
 *
 * Inputs are gradually stored on the concrete target before explicit start. Completion
 * replaces the target item in-place with exactly one result item. Source blueprint recipes
 * may omit resultItemId when it is conventionally derived from the craft target id.
 */
const CraftRecipeSchema = z
	.object({
		resultItemId: IdSchema,
		inputs: z.array(CraftRecipeInputSchema),
		requirements: ActivationRequirementSchema.default([]),
		durationMs: NonNegativeIntegerSchema,
	})
	.strict();

const CraftRecipeFragmentSchema = CraftRecipeSchema.extend({
	resultItemId: IdSchema.optional(),
});

/**
 * Producer product line.
 *
 * Missing `output` means a valid delayed sink/destructor product.
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
		durationMs: NonNegativeIntegerSchema,
		placement: PlacementSchema,
		chargeCost: NonNegativeNumberSchema.default(0),
		inputs: ActivationInputSchema.optional(),
		requirementIds: z.array(IdSchema).default([]),
		hinderedBy: GameHindrancesSchema.optional(),
		output: ActivationOutputSchema.min(1).optional(),
		activatesEffectId: IdSchema.optional(),
	})
	.strict();

const ProductDefinitionFragmentSchema = ProductDefinitionSchema.extend({
	name: z.string().min(1).optional(),
});

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
		assets: z.record(IdSchema, AssetDefinitionFragmentSchema).optional(),
		items: z.record(IdSchema, ItemDefinitionFragmentSchema).optional(),
		merge: z.record(IdSchema, MergeDefinitionSchema).optional(),
		requirements: z.record(IdSchema, GameRequirementDefinitionSchema).optional(),
		effects: z.record(IdSchema, GameEffectDefinitionSchema).optional(),
		producers: z.record(IdSchema, ProducerDefinitionSchema).optional(),
		stashes: z.record(IdSchema, StashDefinitionSchema).optional(),
		craftRecipes: z.record(IdSchema, CraftRecipeFragmentSchema).optional(),
		products: z.record(IdSchema, ProductDefinitionFragmentSchema).optional(),
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
		requirements: z.record(IdSchema, GameRequirementDefinitionSchema),
		effects: z.record(IdSchema, GameEffectDefinitionSchema).default({}),
		producers: z.record(IdSchema, ProducerDefinitionSchema),
		stashes: z.record(IdSchema, StashDefinitionSchema),
		craftRecipes: z.record(IdSchema, CraftRecipeSchema),
		products: z.record(IdSchema, ProductDefinitionSchema),
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
	const hasRequirement = createRecordGuard(value.requirements);
	const hasEffect = createRecordGuard(value.effects);
	const hasProducer = createRecordGuard(value.producers);
	const hasProduct = createRecordGuard(value.products);
	const hasStash = createRecordGuard(value.stashes);
	const hasCraftRecipe = createRecordGuard(value.craftRecipes);

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

			if (operation.kind === "loot.appendOutput" || operation.kind === "loot.replaceOutput") {
				validateActivationOutput(
					ctx,
					[
						"effects",
						effectId,
						"operations",
						operationIndex,
						"output",
					],
					operation.output,
					hasItem,
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

	for (const producerId of Object.keys(value.producers)) {
		if (!hasItem(producerId)) {
			addIssue(
				ctx,
				[
					"producers",
					producerId,
				],
				`Producer "${producerId}" must be keyed by its item id.`,
			);
		}
	}

	for (const stashId of Object.keys(value.stashes)) {
		if (!hasItem(stashId)) {
			addIssue(
				ctx,
				[
					"stashes",
					stashId,
				],
				`Stash "${stashId}" must be keyed by its item id.`,
			);
		}
	}

	for (const craftRecipeId of Object.keys(value.craftRecipes)) {
		if (!hasItem(craftRecipeId)) {
			addIssue(
				ctx,
				[
					"craftRecipes",
					craftRecipeId,
				],
				`Craft recipe "${craftRecipeId}" must be keyed by its craft target item id.`,
			);
		}
	}

	const validateProducerCapability = ({
		capability,
		capabilityId,
		section,
	}: {
		capability: GameConfig["producers"][string] | GameConfig["stashes"][string];
		capabilityId: string;
		section: "producers" | "stashes";
	}) => {
		validateUniqueStringList(
			ctx,
			[
				section,
				capabilityId,
				"productIds",
			],
			capability.productIds,
			(value) => `Duplicate product "${value}".`,
		);

		for (const [index, productId] of capability.productIds.entries()) {
			const product = value.products[productId];
			if (!product) {
				addIssue(
					ctx,
					[
						section,
						capabilityId,
						"productIds",
						index,
					],
					`Missing product "${productId}".`,
				);
				continue;
			}

			if (section === "stashes" && product.chargeCost <= 0) {
				addIssue(
					ctx,
					[
						section,
						capabilityId,
						"productIds",
						index,
					],
					`Stash product "${productId}" must spend charges with chargeCost > 0.`,
				);
			}
		}

		validateRequirementIds(
			ctx,
			[
				section,
				capabilityId,
				"requirementIds",
			],
			capability.requirementIds,
			hasRequirement,
		);
		validateGameHindrances(
			ctx,
			[
				section,
				capabilityId,
				"hinderedBy",
			],
			capability.hinderedBy ?? [],
			hasItem,
		);
	};

	for (const [producerId, producer] of Object.entries(value.producers)) {
		validateProducerCapability({
			capability: producer,
			capabilityId: producerId,
			section: "producers",
		});
	}

	for (const [stashId, stash] of Object.entries(value.stashes)) {
		validateProducerCapability({
			capability: stash,
			capabilityId: stashId,
			section: "stashes",
		});
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
		} else if (value.items[recipe.resultItemId]?.storage === "inventory") {
			addIssue(
				ctx,
				[
					"craftRecipes",
					craftRecipeId,
					"resultItemId",
				],
				`Craft recipe result "${recipe.resultItemId}" must be placeable on the board because craft completion replaces the board target.`,
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

	for (const [productId, product] of Object.entries(value.products)) {
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

		const activatedEffect = product.activatesEffectId
			? value.effects[product.activatesEffectId]
			: undefined;
		if (activatedEffect?.sourceScope === "inventory") {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"activatesEffectId",
				],
				`Active effect product "${productId}" activates board-source effect "${product.activatesEffectId}" and cannot use inventory-only sourceScope.`,
			);
		}

		if (product.activatesEffectId && product.output) {
			addIssue(
				ctx,
				[
					"products",
					productId,
					"activatesEffectId",
				],
				"Active effect product lines must not also define output.",
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

const validateProductLineOwnership = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	const ownerByProductId = new Map<string, string>();
	const validateOwner = ({
		capabilityId,
		productIds,
		section,
	}: {
		capabilityId: string;
		productIds: readonly string[];
		section: "producers" | "stashes";
	}) => {
		for (const [productIndex, productId] of productIds.entries()) {
			const previousCapabilityId = ownerByProductId.get(productId);
			if (previousCapabilityId) {
				addIssue(
					ctx,
					[
						section,
						capabilityId,
						"productIds",
						productIndex,
					],
					`Product "${productId}" must be owned by exactly one producer-like capability. First used by "${previousCapabilityId}".`,
				);
				continue;
			}

			ownerByProductId.set(productId, capabilityId);
		}
	};

	for (const [producerId, producer] of Object.entries(config.producers)) {
		validateOwner({
			capabilityId: producerId,
			productIds: producer.productIds,
			section: "producers",
		});
	}
	for (const [stashId, stash] of Object.entries(config.stashes)) {
		validateOwner({
			capabilityId: stashId,
			productIds: stash.productIds,
			section: "stashes",
		});
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
		consume: boolean;
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

		if (!input.consume) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"consume",
				],
				"Craft inputs must currently be consumed because craft start clears stored input state and completion replaces the board target.",
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

type ValidatedItemRequirement =
	| {
			capacity?: number;
			itemId: string;
			quantity: number;
			scope?: string;
			type: "passive" | "stored";
	  }
	| {
			distance: number;
			itemIds: readonly string[];
			type: "proximity";
	  };

const readRequirementItemIdsKey = (itemIds: readonly string[]) =>
	[
		...itemIds,
	]
		.sort()
		.join("|");

const readItemRequirementUniqueKey = (requirement: ValidatedItemRequirement) => {
	if (requirement.type === "passive") {
		return `${requirement.type}:${requirement.itemId}:${requirement.scope}`;
	}

	if (requirement.type === "proximity") {
		return `${requirement.type}:${readRequirementItemIdsKey(requirement.itemIds)}:${requirement.distance}`;
	}

	return `${requirement.type}:${requirement.itemId}`;
};

const validateItemRequirements = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	requirements: readonly ValidatedItemRequirement[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		requirements.map(readItemRequirementUniqueKey),
		(value) => `Duplicate requirement "${value}".`,
	);

	for (const [index, requirement] of requirements.entries()) {
		if (requirement.type === "proximity") {
			for (const [itemIndex, itemId] of requirement.itemIds.entries()) {
				if (hasItem(itemId)) continue;

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
			continue;
		}

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
