import { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/selector/doesResolvedDomainSelectorMatchId";

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
 *   Product inputs may use `mode: "upTo"` when a run should consume 1..quantity items for the same fixed output.
 * - Passive and active `effects` only publish global grant facts. They do not target,
 *   mutate, or reach into product lines. Product and craft lines own their own
 *   visibility requirements, start requirements, proximity checks, and modifiers.
 * - Nearby line effects use Chebyshev grid distance, so radius 1 includes diagonals
 *   around the producer/craft tile. Duration changes are authored as explicit
 *   line-owned distance bands or grant-driven multipliers.
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
 *   "effects": {}
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
 *       "productIds": ["product:lumber-camp.basic", "product:lumber-camp.saw"]
 *     }
 *   },
 *   "products": {
 *     "product:lumber-camp.saw": {
 *       "name": "Saw logs",
 *       "durationMs": 5000,
 *       "placement": "board_then_inventory",
 *       "inputs": [{ "itemId": "item:log", "quantity": 1, "capacity": 1, "consume": true }],
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
const PositiveProbabilitySchema = z.number().gt(0).max(1);
const ActivationInputModeSchema = z.enum([
	"exact",
	"upTo",
]);
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

const SortSchema = z.number().finite();

/**
 * Input slot for activations that can be gradually filled by product lines.
 * `consume` is required because config authors must see whether a fed item disappears. Missing quantity defaults to 1 because needing one item is the boring common case, not a revelation.
 * Missing `mode` means `exact`: the product needs and consumes exactly `quantity`.
 * `mode: "upTo"` means the product can start with at least one stored item and consumes up to `quantity` for the same fixed output.
 */
const ItemStackInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema.default(1),
		capacity: PositiveIntegerSchema,
		consume: z.boolean(),
		mode: ActivationInputModeSchema.optional(),
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

const ActivationInputSchema = z.array(ItemStackInputSchema);

const TagSchema = z.string().min(1);

const ResolvedDomainSelectorClauseSchema = z
	.object({
		ids: z.array(IdSchema).min(1),
	})
	.strict();

/** Canonical runtime selector. Tags are resolved to id clauses during package normalization. */
const ResolvedDomainSelectorSchema = z.union([
	z
		.object({
			mode: z.literal("all"),
		})
		.strict(),
	z
		.object({
			anyOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
			allOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
			noneOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
		})
		.strict(),
]);

const AuthoringDomainSelectorRefSchema = z.union([
	z
		.object({
			id: IdSchema,
		})
		.strict(),
	z
		.object({
			ids: z.array(IdSchema).min(1),
		})
		.strict(),
	z
		.object({
			tag: TagSchema,
		})
		.strict(),
]);

/** Source-only selector accepted by game package fragments before compile-time tag expansion. */
const AuthoringDomainSelectorSchema = z.union([
	z
		.object({
			mode: z.literal("all"),
		})
		.strict(),
	z
		.object({
			anyOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
			allOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
			noneOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
		})
		.strict(),
]);

/** Grant selectors describe domain capabilities, not concrete source items. */
const GameGrantSelectorSchema = ResolvedDomainSelectorSchema;

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
				sort: SortSchema.optional(),
			})
			.strict(),
		z
			.object({
				type: z.literal("chance"),
				itemId: IdSchema,
				chance: z.number().min(0).max(1),
				quantity: QuantitySchema.default(1),
				sort: SortSchema.optional(),
			})
			.strict(),
		z
			.object({
				type: z.literal("weighted"),
				rolls: QuantitySchema.default(1),
				sort: SortSchema.optional(),
				entries: z
					.array(
						z
							.object({
								itemId: IdSchema,
								weight: PositiveIntegerSchema,
								quantity: QuantitySchema.default(1),
								sort: SortSchema.optional(),
							})
							.strict(),
					)
					.min(1),
			})
			.strict(),
	]),
);

const GameEffectSourceScopeSchema = z.enum([
	"board",
	"inventory",
	"both",
]);

const GameEffectPolaritySchema = z.enum([
	"buff",
	"debuff",
	"neutral",
	"mixed",
]);

const GameLineEffectDisplaySchema = z
	.enum([
		"always",
		"whenActive",
		"whenMissing",
		"never",
	])
	.default("whenActive");

const GameLineEffectPhaseSchema = z
	.enum([
		"visibility",
		"start",
	])
	.default("start");

const DurationMultiplierSchema = z
	.number()
	.min(0)
	.refine((value) => value !== 1, {
		message: "Duration multiplier must change timing; 1 is a no-op.",
	});

const GameLineEffectDistanceBandSchema = z
	.object({
		minDistance: NonNegativeIntegerSchema.default(0),
		maxDistance: NonNegativeIntegerSchema.optional(),
		multiplier: z.number().min(0),
	})
	.strict()
	.refine((value) => value.maxDistance === undefined || value.maxDistance >= value.minDistance, {
		message: "maxDistance must be >= minDistance",
	});

const GameNearbyItemSelectorSchema = z
	.object({
		items: ResolvedDomainSelectorSchema,
	})
	.strict();

const GameNearbyItemAuthoringSelectorSchema = z
	.object({
		items: AuthoringDomainSelectorSchema,
	})
	.strict();

const createGameLineEffectSchema = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	z.discriminatedUnion("kind", [
		z
			.object({
				kind: z.literal("grant.require"),
				selector: GameGrantSelectorSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.blockStart"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.require"),
				...itemSelectorSchema.shape,
				radius: NonNegativeIntegerSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.duration.multiply"),
				...itemSelectorSchema.shape,
				radius: NonNegativeIntegerSchema,
				bands: z.array(GameLineEffectDistanceBandSchema).min(1),
				maxSources: PositiveIntegerSchema.optional(),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.duration.multiply"),
				selector: GameGrantSelectorSchema,
				multiplier: DurationMultiplierSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.loot.extraOutputChance.add"),
				selector: GameGrantSelectorSchema,
				outputItems: itemSelectorSchema,
				chance: PositiveProbabilitySchema,
				quantity: QuantitySchema.default(1),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
	]);

const GameLineEffectSchema = createGameLineEffectSchema(GameNearbyItemSelectorSchema);
const GameLineEffectAuthoringSchema = createGameLineEffectSchema(
	GameNearbyItemAuthoringSelectorSchema,
);

const GameEffectGrantDefinitionSchema = z
	.object({
		id: IdSchema,
		name: z.string().min(1),
	})
	.strict();

const GameEffectDefinitionSchema = z
	.object({
		name: z.string().min(1),
		polarity: GameEffectPolaritySchema,
		grants: z.array(GameEffectGrantDefinitionSchema).min(1),
		sourceScope: GameEffectSourceScopeSchema.optional(),
	})
	.strict();

const GameEffectAuthoringDefinitionSchema = GameEffectDefinitionSchema;

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

/** Render-facing asset metadata that maps game definitions to generated resources. Asset ids carry the domain convention; no duplicate kind field. */
const AssetDefinitionSchema = z
	.object({
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

/** Producer-like capability with ordered product lines. Product-line gates live on product lines/effects. */
const ProducerDefinitionSchema = z
	.object({
		maxQueueSize: PositiveIntegerSchema.default(1),
		productIds: z.array(IdSchema).min(1),
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
		effects: z.array(GameLineEffectSchema).optional(),
		durationMs: NonNegativeIntegerSchema,
	})
	.strict();

const CraftRecipeFragmentSchema = CraftRecipeSchema.extend({
	resultItemId: IdSchema.optional(),
	effects: z.array(GameLineEffectAuthoringSchema).optional(),
});

/**
 * Producer product line.
 *
 * Missing `output` means a valid delayed sink/destructor product.
 * `visibility: "hidden"` keeps the line hidden until its own visibility-phase line
 * effects are satisfied. Start-phase effects keep visible lines disabled instead of
 * pretending the line does not exist.
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
		effects: z.array(GameLineEffectSchema).optional(),
		durationMs: NonNegativeIntegerSchema,
		placement: PlacementSchema,
		chargeCost: NonNegativeNumberSchema.default(0),
		inputs: ActivationInputSchema.optional(),
		output: ActivationOutputSchema.min(1).optional(),
		activatesEffectId: IdSchema.optional(),
	})
	.strict();

const ProductDefinitionFragmentSchema = ProductDefinitionSchema.extend({
	name: z.string().min(1).optional(),
	effects: z.array(GameLineEffectAuthoringSchema).optional(),
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
		effects: z.record(IdSchema, GameEffectAuthoringDefinitionSchema).optional(),
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
	const hasEffect = createRecordGuard(value.effects);
	const hasProducer = createRecordGuard(value.producers);
	const hasProduct = createRecordGuard(value.products);
	const hasStash = createRecordGuard(value.stashes);
	const itemIds = Object.keys(value.items);
	const producerIds = Object.keys(value.producers);
	const productIds = Object.keys(value.products);
	const hasCraftRecipe = createRecordGuard(value.craftRecipes);
	const grantIds = readGameEffectGrantIds(value);

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
		if (!value.assets[item.assetId]) {
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

	for (const [effectId, effect] of Object.entries(value.effects)) {
		validateUniqueStringList(
			ctx,
			[
				"effects",
				effectId,
				"grants",
			],
			effect.grants.map((grant) => grant.id),
			(value) => `Duplicate grant id "${value}".`,
		);
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
		validateGameLineEffects(
			ctx,
			[
				"craftRecipes",
				craftRecipeId,
				"effects",
			],
			recipe.effects ?? [],
			{
				grantIds,
				hasItem,
				itemIds,
			},
		);
		validateCraftRecipeEffectRuntimeSupport(
			ctx,
			[
				"craftRecipes",
				craftRecipeId,
				"effects",
			],
			recipe.effects ?? [],
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
		validateGameLineEffects(
			ctx,
			[
				"products",
				productId,
				"effects",
			],
			product.effects ?? [],
			{
				grantIds,
				hasItem,
				itemIds,
			},
		);
		validateProductExtraOutputChanceEffects(
			ctx,
			[
				"products",
				productId,
				"effects",
			],
			product,
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
	validateBlueprintDependencyCycles(ctx, value);
	validateGameplaySoftLockRisks(ctx, value);
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

const readDomainSelectorIds = (selector: z.infer<typeof ResolvedDomainSelectorSchema>) => {
	if ("mode" in selector) return [];
	return [
		...(selector.anyOf ?? []),
		...(selector.allOf ?? []),
		...(selector.noneOf ?? []),
	].flatMap((clause) => clause.ids);
};

const validateResolvedDomainSelectorClauses = ({
	clauses,
	ctx,
	hasEntity,
	label,
	path,
}: {
	clauses: readonly z.infer<typeof ResolvedDomainSelectorClauseSchema>[] | undefined;
	ctx: z.RefinementCtx;
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
}) => {
	for (const [clauseIndex, clause] of (clauses ?? []).entries()) {
		validateUniqueStringList(
			ctx,
			[
				...path,
				clauseIndex,
				"ids",
			],
			clause.ids,
			(value) => `Duplicate ${label} "${value}".`,
		);

		for (const [index, entityId] of clause.ids.entries()) {
			if (hasEntity(entityId)) continue;
			addIssue(
				ctx,
				[
					...path,
					clauseIndex,
					"ids",
					index,
				],
				`Missing ${label} "${entityId}".`,
			);
		}
	}
};

const validateResolvedDomainSelector = ({
	ctx,
	entityIds,
	hasEntity,
	label,
	path,
	selector,
}: {
	ctx: z.RefinementCtx;
	entityIds: readonly string[];
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Domain selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	validateResolvedDomainSelectorClauses({
		clauses: selector.anyOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"anyOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.allOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"allOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.noneOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"noneOf",
		],
	});

	if (
		!entityIds.some((entityId) =>
			doesResolvedDomainSelectorMatchId({
				entityId,
				selector,
			}),
		)
	) {
		addIssue(ctx, path, `Domain selector matched no ${label}s.`);
	}
};

const validateGameGrantSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof GameGrantSelectorSchema>,
	grantIds: readonly string[],
) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Grant selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	const hasGrant = (grantId: string) => grantIds.includes(grantId);
	validateResolvedDomainSelectorClauses({
		clauses: selector.anyOf,
		ctx,
		hasEntity: hasGrant,
		label: "grant",
		path: [
			...path,
			"anyOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.allOf,
		ctx,
		hasEntity: hasGrant,
		label: "grant",
		path: [
			...path,
			"allOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.noneOf,
		ctx,
		hasEntity: hasGrant,
		label: "grant",
		path: [
			...path,
			"noneOf",
		],
	});
};

const validateGameLineItemSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	entities: {
		entityIds: readonly string[];
		hasEntity: (itemId: string) => boolean;
	},
) => {
	validateResolvedDomainSelector({
		ctx,
		entityIds: entities.entityIds,
		hasEntity: entities.hasEntity,
		label: "item",
		path,
		selector,
	});
};

const validateGameLineEffects = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly z.infer<typeof GameLineEffectSchema>[],
	entities: {
		grantIds: readonly string[];
		hasItem: (itemId: string) => boolean;
		itemIds: readonly string[];
	},
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		if (
			effect.kind === "grant.require" ||
			effect.kind === "grant.blockStart" ||
			effect.kind === "grant.duration.multiply" ||
			effect.kind === "grant.loot.extraOutputChance.add"
		) {
			validateGameGrantSelector(
				ctx,
				[
					...path,
					effectIndex,
					"selector",
				],
				effect.selector,
				entities.grantIds,
			);
		}

		if (effect.kind === "nearby.require" || effect.kind === "nearby.duration.multiply") {
			validateGameLineItemSelector(
				ctx,
				[
					...path,
					effectIndex,
					"items",
				],
				effect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
				{
					entityIds: entities.itemIds,
					hasEntity: entities.hasItem,
				},
			);
		}

		if (
			effect.kind === "nearby.duration.multiply" &&
			effect.bands.every((band) => band.multiplier === 1)
		) {
			addIssue(
				ctx,
				[
					...path,
					effectIndex,
					"bands",
				],
				"Nearby duration effect must contain at least one non-1 multiplier band.",
			);
		}

		if (effect.kind === "grant.loot.extraOutputChance.add") {
			validateGameLineItemSelector(
				ctx,
				[
					...path,
					effectIndex,
					"outputItems",
					"items",
				],
				effect.outputItems.items as z.infer<typeof ResolvedDomainSelectorSchema>,
				{
					entityIds: entities.itemIds,
					hasEntity: entities.hasItem,
				},
			);
		}
	}
};

const validateCraftRecipeEffectRuntimeSupport = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly z.infer<typeof GameLineEffectSchema>[],
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		if (effect.kind === "grant.blockStart") continue;

		if (effect.kind === "grant.require") {
			if (effect.phase !== "start") {
				addIssue(
					ctx,
					[
						...path,
						effectIndex,
						"phase",
					],
					'Craft recipe grant requirements only support phase "start" because craft targets do not own visible product lines.',
				);
			}
			continue;
		}

		addIssue(
			ctx,
			[
				...path,
				effectIndex,
				"kind",
			],
			`Craft recipe effects only support "grant.require" start gates and "grant.blockStart" blockers at runtime. "${effect.kind}" is a producer product-line effect.`,
		);
	}
};

const validateProductExtraOutputChanceEffects = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	product: z.infer<typeof ProductDefinitionSchema>,
) => {
	const selectableOutputItemIds = (product.output ?? []).flatMap((outputEntry) =>
		outputEntry.type === "weighted"
			? []
			: [
					outputEntry.itemId,
				],
	);

	for (const [effectIndex, effect] of (product.effects ?? []).entries()) {
		if (effect.kind !== "grant.loot.extraOutputChance.add") continue;

		if (selectableOutputItemIds.length === 0) {
			addIssue(
				ctx,
				[
					...path,
					effectIndex,
					"kind",
				],
				"Extra output chance effects require at least one non-weighted base output item on the product line.",
			);
			continue;
		}

		const matchesOutput = selectableOutputItemIds.some((itemId) =>
			doesResolvedDomainSelectorMatchId({
				entityId: itemId,
				selector: effect.outputItems.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			}),
		);
		if (matchesOutput) continue;

		addIssue(
			ctx,
			[
				...path,
				effectIndex,
				"outputItems",
				"items",
			],
			"Extra output chance selector must match at least one non-weighted base output item on the same product line.",
		);
	}
};

const readGameEffectGrantIds = (config: z.infer<typeof BaseGameConfigSchema>) => [
	...new Set(
		Object.values(config.effects).flatMap((effect) => effect.grants.map((grant) => grant.id)),
	),
];

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

type BlueprintDependencyEdge = {
	path: GameConfigIssuePath;
	toBlueprintItemId: string;
	viaItemId: string;
};

const validateBlueprintDependencyCycles = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	const blueprintItemIds = readBlueprintItemIds(config);
	const blueprintItemIdsByCraftResultItemId = readBlueprintItemIdsByCraftResultItemId(
		config,
		blueprintItemIds,
	);
	const edgesByBlueprintItemId = new Map<string, BlueprintDependencyEdge[]>();
	const addDependencyItem = (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => {
		for (const toBlueprintItemId of readBlueprintDependenciesForItem({
			blueprintItemIds,
			blueprintItemIdsByCraftResultItemId,
			itemId: props.itemId,
		})) {
			const edges = edgesByBlueprintItemId.get(props.fromBlueprintItemId) ?? [];
			edges.push({
				path: props.path,
				toBlueprintItemId,
				viaItemId: props.itemId,
			});
			edgesByBlueprintItemId.set(props.fromBlueprintItemId, edges);
		}
	};

	collectCraftRecipeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds,
		config,
	});
	collectProductBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds,
		config,
	});
	collectMergeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds,
		config,
	});

	for (const cycle of readBlueprintDependencyCycles({
		blueprintItemIds,
		edgesByBlueprintItemId,
	})) {
		const firstCycleEdge = cycle.edges[0];
		const issuePath = firstCycleEdge?.path ?? [
			"items",
			cycle.blueprintItemIds[0] ?? "blueprints",
		];
		const cycleLabel = cycle.blueprintItemIds
			.map((itemId) => readBlueprintItemDisplayName(config, itemId))
			.join(" -> ");
		const viaLabel = firstCycleEdge ? ` via required item "${firstCycleEdge.viaItemId}"` : "";

		addIssue(
			ctx,
			issuePath,
			`Blueprint dependency cycle detected${viaLabel}: ${cycleLabel}. Blueprint progression must not require itself directly or through another blueprint/building chain.`,
		);
	}
};

const readBlueprintItemIds = (config: z.infer<typeof BaseGameConfigSchema>) =>
	new Set(
		Object.entries(config.items)
			.filter(([itemId, item]) => {
				const asset = config.assets[item.assetId];

				return (
					itemId.startsWith("item:blueprint-") ||
					item.tags.includes("blueprint") ||
					asset?.render === "blueprint"
				);
			})
			.map(([itemId]) => itemId),
	);

const readBlueprintItemIdsByCraftResultItemId = (
	config: z.infer<typeof BaseGameConfigSchema>,
	blueprintItemIds: ReadonlySet<string>,
) => {
	const result = new Map<string, string[]>();

	for (const [craftRecipeId, recipe] of Object.entries(config.craftRecipes)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;

		result.set(recipe.resultItemId, [
			...(result.get(recipe.resultItemId) ?? []),
			craftRecipeId,
		]);
	}

	return result;
};

const readBlueprintDependenciesForItem = ({
	blueprintItemIds,
	blueprintItemIdsByCraftResultItemId,
	itemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	itemId: string;
}) => {
	const dependencies = new Set<string>();

	if (blueprintItemIds.has(itemId)) {
		dependencies.add(itemId);
	}

	for (const blueprintItemId of blueprintItemIdsByCraftResultItemId.get(itemId) ?? []) {
		dependencies.add(blueprintItemId);
	}

	return dependencies;
};

const collectCraftRecipeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: z.infer<typeof BaseGameConfigSchema>;
}) => {
	for (const [craftRecipeId, recipe] of Object.entries(config.craftRecipes)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;

		for (const [inputIndex, input] of recipe.inputs.entries()) {
			addDependencyItem({
				fromBlueprintItemId: craftRecipeId,
				itemId: input.itemId,
				path: [
					"craftRecipes",
					craftRecipeId,
					"inputs",
					inputIndex,
					"itemId",
				],
			});
		}

		collectLineEffectDependencyItems({
			addDependencyItem,
			config,
			fromBlueprintItemId: craftRecipeId,
			lineEffects: recipe.effects ?? [],
			path: [
				"craftRecipes",
				craftRecipeId,
				"effects",
			],
		});
	}
};

const collectProductBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: z.infer<typeof BaseGameConfigSchema>;
}) => {
	const productOwnerByProductId = readProductOwnerByProductId(config);

	for (const [productId, product] of Object.entries(config.products)) {
		const outputBlueprintItemIds = readOutputBlueprintItemIds(
			product.output ?? [],
			blueprintItemIds,
		);

		for (const fromBlueprintItemId of outputBlueprintItemIds) {
			const owner = productOwnerByProductId.get(productId);
			if (owner) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: owner.capabilityId,
					path: [
						owner.section,
						owner.capabilityId,
						"productIds",
						owner.productIndex,
					],
				});
			}

			for (const [inputIndex, input] of (product.inputs ?? []).entries()) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: input.itemId,
					path: [
						"products",
						productId,
						"inputs",
						inputIndex,
						"itemId",
					],
				});
			}

			collectLineEffectDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				lineEffects: product.effects ?? [],
				path: [
					"products",
					productId,
					"effects",
				],
			});
		}
	}
};

const collectMergeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: z.infer<typeof BaseGameConfigSchema>;
}) => {
	for (const [sourceItemId, item] of Object.entries(config.items)) {
		for (const [mergeIndex, mergeId] of (item.mergeIds ?? []).entries()) {
			const merge = config.merge[mergeId];
			if (!merge || !blueprintItemIds.has(merge.resultItemId)) continue;

			addDependencyItem({
				fromBlueprintItemId: merge.resultItemId,
				itemId: sourceItemId,
				path: [
					"items",
					sourceItemId,
					"mergeIds",
					mergeIndex,
				],
			});
			addDependencyItem({
				fromBlueprintItemId: merge.resultItemId,
				itemId: merge.withItemId,
				path: [
					"merge",
					mergeId,
					"withItemId",
				],
			});
		}
	}
};

const readProductOwnerByProductId = (config: z.infer<typeof BaseGameConfigSchema>) => {
	const owners = new Map<
		string,
		{
			capability: GameConfig["producers"][string] | GameConfig["stashes"][string];
			capabilityId: string;
			productIndex: number;
			section: "producers" | "stashes";
		}
	>();
	const collectOwner = (
		section: "producers" | "stashes",
		capabilityId: string,
		capability: GameConfig["producers"][string] | GameConfig["stashes"][string],
	) => {
		for (const [productIndex, productId] of capability.productIds.entries()) {
			owners.set(productId, {
				capability,
				capabilityId,
				productIndex,
				section,
			});
		}
	};

	for (const [producerId, producer] of Object.entries(config.producers)) {
		collectOwner("producers", producerId, producer);
	}
	for (const [stashId, stash] of Object.entries(config.stashes)) {
		collectOwner("stashes", stashId, stash);
	}

	return owners;
};

const readOutputBlueprintItemIds = (
	output: z.infer<typeof ActivationOutputSchema>,
	blueprintItemIds: ReadonlySet<string>,
) => {
	const outputBlueprintItemIds = new Set<string>();

	for (const outputEntry of output) {
		if (outputEntry.type === "weighted") {
			for (const entry of outputEntry.entries) {
				if (blueprintItemIds.has(entry.itemId)) {
					outputBlueprintItemIds.add(entry.itemId);
				}
			}
			continue;
		}

		if (blueprintItemIds.has(outputEntry.itemId)) {
			outputBlueprintItemIds.add(outputEntry.itemId);
		}
	}

	return outputBlueprintItemIds;
};

const collectLineEffectDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	lineEffects,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: z.infer<typeof BaseGameConfigSchema>;
	fromBlueprintItemId: string;
	lineEffects: readonly z.infer<typeof GameLineEffectSchema>[];
	path: GameConfigIssuePath;
}) => {
	for (const [lineEffectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			collectGrantDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				selector: lineEffect.selector,
				path: [
					...path,
					lineEffectIndex,
					"selector",
				],
			});
		}

		if (lineEffect.kind === "nearby.require") {
			for (const itemId of readDomainSelectorIds(
				lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			)) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId,
					path: [
						...path,
						lineEffectIndex,
						"items",
					],
				});
			}
		}
	}
};

const collectGrantDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	selector,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: z.infer<typeof BaseGameConfigSchema>;
	fromBlueprintItemId: string;
	selector: z.infer<typeof GameGrantSelectorSchema> | undefined;
	path: GameConfigIssuePath;
}) => {
	if (!selector) return;

	const grantSourceItemIdsByGrantId = readPassiveGrantSourceItemIdsByGrantId(config);
	for (const grantId of readDomainSelectorIds(selector)) {
		for (const itemId of grantSourceItemIdsByGrantId.get(grantId) ?? []) {
			addDependencyItem({
				fromBlueprintItemId,
				itemId,
				path,
			});
		}
	}
};

const readPassiveGrantSourceItemIdsByGrantId = (config: z.infer<typeof BaseGameConfigSchema>) => {
	const result = new Map<string, string[]>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const effectId of item.passiveEffectIds ?? []) {
			const effect = config.effects[effectId];
			if (!effect) continue;
			for (const grantId of effect.grants.map((grant) => grant.id)) {
				result.set(grantId, [
					...(result.get(grantId) ?? []),
					itemId,
				]);
			}
		}
	}
	return result;
};

const readBlueprintDependencyCycles = ({
	blueprintItemIds,
	edgesByBlueprintItemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>;
}) => {
	const cycles: {
		blueprintItemIds: string[];
		edges: BlueprintDependencyEdge[];
	}[] = [];
	const reportedCycleKeys = new Set<string>();
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const stack: string[] = [];
	const edgeStack: BlueprintDependencyEdge[] = [];
	const stackIndexByBlueprintItemId = new Map<string, number>();

	const visit = (blueprintItemId: string) => {
		if (visited.has(blueprintItemId)) return;

		visiting.add(blueprintItemId);
		stackIndexByBlueprintItemId.set(blueprintItemId, stack.length);
		stack.push(blueprintItemId);

		for (const edge of edgesByBlueprintItemId.get(blueprintItemId) ?? []) {
			const nextBlueprintItemId = edge.toBlueprintItemId;
			const cycleStartIndex = stackIndexByBlueprintItemId.get(nextBlueprintItemId);
			if (cycleStartIndex !== undefined) {
				const cycleBlueprintItemIds = [
					...stack.slice(cycleStartIndex),
					nextBlueprintItemId,
				];
				const cycleEdges = [
					...edgeStack.slice(cycleStartIndex),
					edge,
				];
				const cycleKey = readBlueprintDependencyCycleKey(cycleBlueprintItemIds);
				if (!reportedCycleKeys.has(cycleKey)) {
					reportedCycleKeys.add(cycleKey);
					cycles.push({
						blueprintItemIds: cycleBlueprintItemIds,
						edges: cycleEdges,
					});
				}
				continue;
			}

			if (!visiting.has(nextBlueprintItemId)) {
				edgeStack.push(edge);
				visit(nextBlueprintItemId);
				edgeStack.pop();
			}
		}

		stack.pop();
		stackIndexByBlueprintItemId.delete(blueprintItemId);
		visiting.delete(blueprintItemId);
		visited.add(blueprintItemId);
	};

	for (const blueprintItemId of [
		...blueprintItemIds,
	].sort()) {
		visit(blueprintItemId);
	}

	return cycles;
};

const readBlueprintDependencyCycleKey = (cycleBlueprintItemIds: readonly string[]) => {
	const uniqueCycleItemIds = cycleBlueprintItemIds.slice(0, -1);
	if (uniqueCycleItemIds.length === 0) return cycleBlueprintItemIds.join("->");

	const rotations = uniqueCycleItemIds.map((_, index) =>
		[
			...uniqueCycleItemIds.slice(index),
			...uniqueCycleItemIds.slice(0, index),
		].join("->"),
	);

	return rotations.sort()[0] ?? cycleBlueprintItemIds.join("->");
};

const readBlueprintItemDisplayName = (
	config: z.infer<typeof BaseGameConfigSchema>,
	itemId: string,
) => config.items[itemId]?.name ?? itemId;

type GameplayReachableEntityKind = "grant" | "item";

type GameplayRequirement =
	| {
			itemId: string;
			kind: "item";
			path: GameConfigIssuePath;
	  }
	| {
			kind: "grantSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof GameGrantSelectorSchema>;
	  }
	| {
			kind: "nearbyItemSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
	  };

type GameplaySource = {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
	targetKind: GameplayReachableEntityKind;
};

type GameplayReachability = {
	reachableGrantIds: Set<string>;
	reachableItemIds: Set<string>;
};

const validateGameplaySoftLockRisks = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	const sources = createGameplaySources(config);
	const reachability = readGameplayReachability(config, sources);

	validateNearbyRequirementsHaveBoardSource(ctx, config);
	validateGrantRequirementsHavePossibleSource(ctx, config, sources);
	validateGrantRequirementBlockerContradictions(ctx, config);
	validateProducerGameplayReachability(ctx, config, sources, reachability);
};

const createGameplaySources = (config: z.infer<typeof BaseGameConfigSchema>) => {
	const sources: GameplaySource[] = [];
	const productOwnerByProductId = readProductOwnerByProductId(config);
	const addItemSource = ({
		label,
		path,
		requirements,
		sourceId,
		targetId,
	}: {
		label: string;
		path: GameConfigIssuePath;
		requirements: GameplayRequirement[];
		sourceId: string;
		targetId: string;
	}) => {
		sources.push({
			label,
			path,
			requirements,
			sourceId,
			targetId,
			targetKind: "item",
		});
	};
	const addGrantSource = ({
		label,
		path,
		requirements,
		sourceId,
		targetId,
	}: {
		label: string;
		path: GameConfigIssuePath;
		requirements: GameplayRequirement[];
		sourceId: string;
		targetId: string;
	}) => {
		sources.push({
			label,
			path,
			requirements,
			sourceId,
			targetId,
			targetKind: "grant",
		});
	};

	for (const [index, entry] of config.startingState.board.entries()) {
		addItemSource({
			label: `starting board slot ${index}`,
			path: [
				"startingState",
				"board",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:board:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		});
	}

	for (const [index, entry] of config.startingState.inventory.entries()) {
		addItemSource({
			label: `starting inventory stack ${index}`,
			path: [
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:inventory:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		});
	}

	for (const [itemId, item] of Object.entries(config.items)) {
		for (const [effectIndex, effectId] of (item.passiveEffectIds ?? []).entries()) {
			const effect = config.effects[effectId];
			if (!effect) continue;

			for (const grant of effect.grants) {
				addGrantSource({
					label: `passive effect "${effectId}" on ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"passiveEffectIds",
						effectIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
							],
						}),
					],
					sourceId: `passive:${itemId}:${effectId}:${grant.id}`,
					targetId: grant.id,
				});
			}
		}

		for (const [mergeIndex, mergeId] of (item.mergeIds ?? []).entries()) {
			const merge = config.merge[mergeId];
			if (!merge) continue;

			addItemSource({
				label: `merge "${mergeId}" from ${formatItemLabel(config, itemId)}`,
				path: [
					"items",
					itemId,
					"mergeIds",
					mergeIndex,
				],
				requirements: [
					createItemRequirement({
						itemId,
						path: [
							"items",
							itemId,
							"mergeIds",
							mergeIndex,
						],
					}),
					createItemRequirement({
						itemId: merge.withItemId,
						path: [
							"merge",
							mergeId,
							"withItemId",
						],
					}),
				],
				sourceId: `merge:${itemId}:${mergeId}`,
				targetId: merge.resultItemId,
			});
		}
	}

	for (const [craftRecipeId, recipe] of Object.entries(config.craftRecipes)) {
		addItemSource({
			label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, recipe.resultItemId)}`,
			path: [
				"craftRecipes",
				craftRecipeId,
			],
			requirements: [
				createItemRequirement({
					itemId: craftRecipeId,
					path: [
						"craftRecipes",
						craftRecipeId,
					],
				}),
				...recipe.inputs.map((input, inputIndex) =>
					createItemRequirement({
						itemId: input.itemId,
						path: [
							"craftRecipes",
							craftRecipeId,
							"inputs",
							inputIndex,
							"itemId",
						],
					}),
				),
				...readLineEffectGameplayRequirements({
					lineEffects: recipe.effects ?? [],
					path: [
						"craftRecipes",
						craftRecipeId,
						"effects",
					],
				}),
			],
			sourceId: `craft:${craftRecipeId}`,
			targetId: recipe.resultItemId,
		});
	}

	for (const [productId, product] of Object.entries(config.products)) {
		const owner = productOwnerByProductId.get(productId);
		if (!owner) continue;

		const productRequirements: GameplayRequirement[] = [
			createItemRequirement({
				itemId: owner.capabilityId,
				path: [
					owner.section,
					owner.capabilityId,
					"productIds",
					owner.productIndex,
				],
			}),
			...(product.inputs ?? []).map((input, inputIndex) =>
				createItemRequirement({
					itemId: input.itemId,
					path: [
						"products",
						productId,
						"inputs",
						inputIndex,
						"itemId",
					],
				}),
			),
			...readLineEffectGameplayRequirements({
				lineEffects: product.effects ?? [],
				path: [
					"products",
					productId,
					"effects",
				],
			}),
		];

		for (const outputItemId of readActivationOutputItemIds(product.output ?? [])) {
			addItemSource({
				label: `product "${productId}" (${product.name})`,
				path: [
					"products",
					productId,
				],
				requirements: productRequirements,
				sourceId: `product:${productId}:output:${outputItemId}`,
				targetId: outputItemId,
			});
		}

		if (!product.activatesEffectId) continue;

		const effect = config.effects[product.activatesEffectId];
		if (!effect) continue;

		for (const grant of effect.grants) {
			addGrantSource({
				label: `active effect product "${productId}" (${product.name})`,
				path: [
					"products",
					productId,
					"activatesEffectId",
				],
				requirements: productRequirements,
				sourceId: `product:${productId}:active:${product.activatesEffectId}:${grant.id}`,
				targetId: grant.id,
			});
		}
	}

	return sources;
};

const readGameplayReachability = (
	config: z.infer<typeof BaseGameConfigSchema>,
	sources: readonly GameplaySource[],
): GameplayReachability => {
	const reachableItemIds = new Set<string>();
	const reachableGrantIds = new Set<string>();
	const appliedSourceIds = new Set<string>();
	let changed = true;

	while (changed) {
		changed = false;

		for (const source of sources) {
			if (appliedSourceIds.has(source.sourceId)) continue;
			if (
				!source.requirements.every((requirement) =>
					isGameplayRequirementSatisfied({
						config,
						reachableGrantIds,
						reachableItemIds,
						requirement,
					}),
				)
			) {
				continue;
			}

			appliedSourceIds.add(source.sourceId);

			if (source.targetKind === "item") {
				if (!reachableItemIds.has(source.targetId)) {
					reachableItemIds.add(source.targetId);
					changed = true;
				}
				continue;
			}

			if (!reachableGrantIds.has(source.targetId)) {
				reachableGrantIds.add(source.targetId);
				changed = true;
			}
		}
	}

	return {
		reachableGrantIds,
		reachableItemIds,
	};
};

const validateProducerGameplayReachability = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
	sources: readonly GameplaySource[],
	reachability: GameplayReachability,
) => {
	for (const producerId of Object.keys(config.producers).sort()) {
		if (!isGameplayProgressionProducer(config, producerId)) continue;
		if (reachability.reachableItemIds.has(producerId)) continue;

		addIssue(
			ctx,
			[
				"producers",
				producerId,
			],
			formatUnreachableGameplayTargetMessage({
				config,
				reachability,
				sources,
				targetId: producerId,
				targetKind: "item",
				targetLabel: `producer ${formatItemLabel(config, producerId)}`,
			}),
		);
	}
};

const isGameplayProgressionProducer = (
	config: z.infer<typeof BaseGameConfigSchema>,
	producerId: string,
) => {
	const item = config.items[producerId];
	return producerId.startsWith("producer:") || item?.tags.includes("producer") === true;
};

const validateNearbyRequirementsHaveBoardSource = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (lineEffect.kind !== "nearby.require") continue;

			const matchingBoardItemIds = readSelectorMatchingIds({
				entityIds: Object.keys(config.items),
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			}).filter((itemId) => config.items[itemId]?.storage !== "inventory");

			if (matchingBoardItemIds.length > 0) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"items",
				],
				`Soft-lock risk: nearby requirement on ${usage.label} cannot be satisfied because its selector matches no board-placeable item. Selector: ${formatItemSelector(config, lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>)}.`,
			);
		}
	}
};

const validateGrantRequirementsHavePossibleSource = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
	sources: readonly GameplaySource[],
) => {
	const possibleGrantIds = new Set(
		sources.filter((source) => source.targetKind === "grant").map((source) => source.targetId),
	);

	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (lineEffect.kind !== "grant.require") continue;
			if (doesGameGrantSelectorMatchIdsLocal(possibleGrantIds, lineEffect.selector)) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"selector",
				],
				`Soft-lock risk: grant requirement on ${usage.label} can never be satisfied because no passive item or active product can provide ${formatGrantSelector(config, lineEffect.selector)}.`,
			);
		}
	}
};

const validateGrantRequirementBlockerContradictions = (
	ctx: z.RefinementCtx,
	config: z.infer<typeof BaseGameConfigSchema>,
) => {
	for (const usage of readLineEffectUsages(config).filter((usage) => usage.enforceSoftLock)) {
		const lineEffects = usage.lineEffects;
		const blockers = lineEffects
			.map((lineEffect, effectIndex) => ({
				effectIndex,
				lineEffect,
			}))
			.filter(
				(
					entry,
				): entry is {
					effectIndex: number;
					lineEffect: Extract<
						z.infer<typeof GameLineEffectSchema>,
						{
							kind: "grant.blockStart";
						}
					>;
				} => entry.lineEffect.kind === "grant.blockStart",
			);

		if (blockers.length === 0) continue;

		for (const [effectIndex, lineEffect] of lineEffects.entries()) {
			if (lineEffect.kind !== "grant.require") continue;
			const requiredGrantIds = readMandatoryGrantIds(lineEffect.selector);
			if (requiredGrantIds.size === 0) continue;

			for (const blocker of blockers) {
				if (
					!doesGameGrantSelectorMatchIdsLocal(
						requiredGrantIds,
						blocker.lineEffect.selector,
					)
				) {
					continue;
				}

				addIssue(
					ctx,
					[
						...usage.path,
						effectIndex,
						"selector",
					],
					`Soft-lock risk: ${usage.label} requires and blocks the same mandatory grant set. Required ${formatGrantSelector(config, lineEffect.selector)} conflicts with blocker ${formatGrantSelector(config, blocker.lineEffect.selector)} at ${formatIssuePath(
						[
							...usage.path,
							blocker.effectIndex,
							"selector",
						],
					)}.`,
				);
			}
		}
	}
};

const readLineEffectUsages = (config: z.infer<typeof BaseGameConfigSchema>) => {
	const productOwnerByProductId = readProductOwnerByProductId(config);

	return [
		...Object.entries(config.products).map(([productId, product]) => {
			const owner = productOwnerByProductId.get(productId);

			return {
				enforceSoftLock:
					owner !== undefined &&
					isGameplayProgressionProducer(config, owner.capabilityId),
				label: `product "${productId}" (${product.name})`,
				lineEffects: product.effects ?? [],
				path: [
					"products",
					productId,
					"effects",
				] satisfies GameConfigIssuePath,
			};
		}),
		...Object.entries(config.craftRecipes).map(([craftRecipeId, recipe]) => ({
			enforceSoftLock: isGameplayProgressionProducer(config, recipe.resultItemId),
			label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, recipe.resultItemId)}`,
			lineEffects: recipe.effects ?? [],
			path: [
				"craftRecipes",
				craftRecipeId,
				"effects",
			] satisfies GameConfigIssuePath,
		})),
	];
};

const readLineEffectGameplayRequirements = ({
	lineEffects,
	path,
}: {
	lineEffects: readonly z.infer<typeof GameLineEffectSchema>[];
	path: GameConfigIssuePath;
}) => {
	const requirements: GameplayRequirement[] = [];

	for (const [effectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			requirements.push({
				kind: "grantSelector",
				path: [
					...path,
					effectIndex,
					"selector",
				],
				selector: lineEffect.selector,
			});
		}

		if (lineEffect.kind === "nearby.require") {
			requirements.push({
				kind: "nearbyItemSelector",
				path: [
					...path,
					effectIndex,
					"items",
				],
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			});
		}
	}

	return requirements;
};

const createItemRequirement = ({
	itemId,
	path,
}: {
	itemId: string;
	path: GameConfigIssuePath;
}): GameplayRequirement => ({
	itemId,
	kind: "item",
	path,
});

const isGameplayRequirementSatisfied = ({
	config,
	reachableGrantIds,
	reachableItemIds,
	requirement,
}: {
	config: z.infer<typeof BaseGameConfigSchema>;
	reachableGrantIds: ReadonlySet<string>;
	reachableItemIds: ReadonlySet<string>;
	requirement: GameplayRequirement;
}) => {
	if (requirement.kind === "item") {
		return reachableItemIds.has(requirement.itemId);
	}

	if (requirement.kind === "grantSelector") {
		return doesGameGrantSelectorMatchIdsLocal(reachableGrantIds, requirement.selector);
	}

	return doesItemSelectorMatchReachableBoardItem({
		config,
		reachableItemIds,
		selector: requirement.selector,
	});
};

const doesItemSelectorMatchReachableBoardItem = ({
	config,
	reachableItemIds,
	selector,
}: {
	config: z.infer<typeof BaseGameConfigSchema>;
	reachableItemIds: ReadonlySet<string>;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	Object.keys(config.items).some(
		(itemId) =>
			reachableItemIds.has(itemId) &&
			config.items[itemId]?.storage !== "inventory" &&
			doesResolvedDomainSelectorMatchId({
				entityId: itemId,
				selector,
			}),
	);

const doesGameGrantSelectorMatchIdsLocal = (
	grantIds: ReadonlySet<string>,
	selector: z.infer<typeof GameGrantSelectorSchema>,
) => {
	if ("mode" in selector) return true;

	if (selector.anyOf && !selector.anyOf.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}

	return true;
};

const hasAnyGrantId = (grantIds: ReadonlySet<string>, ids: readonly string[]) =>
	ids.some((id) => grantIds.has(id));

const readMandatoryGrantIds = (selector: z.infer<typeof GameGrantSelectorSchema>) => {
	const grantIds = new Set<string>();
	if ("mode" in selector) return grantIds;

	for (const clause of selector.allOf ?? []) {
		if (clause.ids.length === 1) {
			grantIds.add(clause.ids[0] ?? "");
		}
	}

	return new Set(
		[
			...grantIds,
		].filter(Boolean),
	);
};

const readActivationOutputItemIds = (output: z.infer<typeof ActivationOutputSchema>) =>
	output.flatMap((entry) => {
		if (entry.type === "weighted") {
			return entry.entries.map((weightedEntry) => weightedEntry.itemId);
		}

		return [
			entry.itemId,
		];
	});

const readSelectorMatchingIds = ({
	entityIds,
	selector,
}: {
	entityIds: readonly string[];
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	entityIds.filter((entityId) =>
		doesResolvedDomainSelectorMatchId({
			entityId,
			selector,
		}),
	);

const formatUnreachableGameplayTargetMessage = ({
	config,
	reachability,
	sources,
	targetId,
	targetKind,
	targetLabel,
}: {
	config: z.infer<typeof BaseGameConfigSchema>;
	reachability: GameplayReachability;
	sources: readonly GameplaySource[];
	targetId: string;
	targetKind: GameplayReachableEntityKind;
	targetLabel: string;
}) => {
	const targetSources = sources.filter(
		(source) => source.targetKind === targetKind && source.targetId === targetId,
	);

	if (targetSources.length === 0) {
		return `Soft-lock risk: ${targetLabel} is not reachable from startingState. No starting entry, merge, craft recipe, product output, passive effect, or active effect can create it.`;
	}

	const closestSource = [
		...targetSources,
	].sort(
		(left, right) =>
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: left.requirements,
			}).length -
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: right.requirements,
			}).length,
	)[0];

	const missingRequirements = closestSource
		? readMissingGameplayRequirements({
				config,
				reachability,
				requirements: closestSource.requirements,
			})
		: [];
	const missingLabel =
		missingRequirements.length > 0
			? ` Missing: ${missingRequirements.slice(0, 6).join("; ")}.`
			: " The dependency chain is cyclic or blocked by selectors that never become true.";
	const sourceLabel = closestSource
		? ` Closest source: ${closestSource.label} at ${formatIssuePath(closestSource.path)}.`
		: "";

	return `Soft-lock risk: ${targetLabel} is not reachable from startingState.${sourceLabel}${missingLabel}`;
};

const readMissingGameplayRequirements = ({
	config,
	reachability,
	requirements,
}: {
	config: z.infer<typeof BaseGameConfigSchema>;
	reachability: GameplayReachability;
	requirements: readonly GameplayRequirement[];
}) =>
	requirements.flatMap((requirement) => {
		if (requirement.kind === "item") {
			return reachability.reachableItemIds.has(requirement.itemId)
				? []
				: [
						`item ${formatItemLabel(config, requirement.itemId)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		if (requirement.kind === "grantSelector") {
			return doesGameGrantSelectorMatchIdsLocal(
				reachability.reachableGrantIds,
				requirement.selector,
			)
				? []
				: [
						`grant ${formatGrantSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		return doesItemSelectorMatchReachableBoardItem({
			config,
			reachableItemIds: reachability.reachableItemIds,
			selector: requirement.selector,
		})
			? []
			: [
					`nearby item ${formatItemSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
				];
	});

const formatIssuePath = (path: readonly (string | number)[]) =>
	path.map((segment) => String(segment)).join(".");

const formatItemLabel = (config: z.infer<typeof BaseGameConfigSchema>, itemId: string) => {
	const itemName = config.items[itemId]?.name;
	return itemName ? `"${itemId}" (${itemName})` : `"${itemId}"`;
};

const formatItemSelector = (
	config: z.infer<typeof BaseGameConfigSchema>,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => formatResolvedSelector(selector, (itemId) => formatItemLabel(config, itemId));

const formatGrantSelector = (
	config: z.infer<typeof BaseGameConfigSchema>,
	selector: z.infer<typeof GameGrantSelectorSchema>,
) => {
	const grantNameById = readGrantNameById(config);
	return formatResolvedSelector(selector, (grantId) => {
		const grantName = grantNameById.get(grantId);
		return grantName ? `"${grantId}" (${grantName})` : `"${grantId}"`;
	});
};

const formatResolvedSelector = (
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	formatId: (id: string) => string,
) => {
	if ("mode" in selector) return 'mode "all"';

	const parts: string[] = [];
	const formatClauses = (label: "allOf" | "anyOf" | "noneOf") => {
		for (const clause of selector[label] ?? []) {
			parts.push(`${label} [${clause.ids.map(formatId).join(" OR ")}]`);
		}
	};

	formatClauses("anyOf");
	formatClauses("allOf");
	formatClauses("noneOf");

	return parts.join(", ") || "empty selector";
};

const readGrantNameById = (config: z.infer<typeof BaseGameConfigSchema>) => {
	const grantNameById = new Map<string, string>();

	for (const effect of Object.values(config.effects)) {
		for (const grant of effect.grants) {
			grantNameById.set(grant.id, grant.name);
		}
	}

	return grantNameById;
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
