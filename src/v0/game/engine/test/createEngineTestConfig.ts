import { parseGameConfig, type GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

type LegacyProducerDefinition = {
	maxQueueSize?: number;
	productIds: string[];
	charges?: number;
	onChargesDepleted?: "remove" | "stop";
};

type LegacyStashDefinition = LegacyProducerDefinition;
type LegacyProductDefinition = GameProducerLineDefinition;
type LegacyProductOverride = Omit<GameProducerLineDefinition, "id"> & {
	id?: string;
};
type LegacyCraftRecipeDefinition = NonNullable<GameConfig["items"][string]["craft"]>;
type LegacyMergeDefinition = NonNullable<GameConfig["items"][string]["merges"]>[number];

type LegacyGameConfigViews = {
	craftRecipes: Record<string, LegacyCraftRecipeDefinition>;
	merge: Record<string, LegacyMergeDefinition>;
	producers: Record<string, LegacyProducerDefinition>;
	products: Record<string, LegacyProductDefinition>;
	stashes: Record<string, LegacyStashDefinition>;
};

type LegacyGameConfigOverrides = Omit<Partial<GameConfig>, "items"> & {
	items?: Record<string, unknown>;
	products?: Record<string, LegacyProductOverride>;
} & Omit<Partial<LegacyGameConfigViews>, "products">;
type DraftGameConfig = {
	assets: Record<string, unknown>;
	effects: Record<string, unknown>;
	game: unknown;
	items: Record<string, unknown>;
	resources: Record<string, unknown>;
	startingState: unknown;
	version: 1;
};

export type EngineTestGameConfig = GameConfig & LegacyGameConfigViews;

export const createEngineTestConfig = (
	overrides: LegacyGameConfigOverrides = {},
): EngineTestGameConfig => {
	const raw = createEmbeddedTestConfig(overrides);
	const config = parseGameConfig(raw) as EngineTestGameConfig;
	return attachLegacyGameConfigViews(config);
};

const createEmbeddedTestConfig = (overrides: LegacyGameConfigOverrides): unknown => {
	const {
		craftRecipes: legacyCraftRecipes,
		merge: legacyMerge,
		producers: legacyProducers,
		products: legacyProducts,
		stashes: legacyStashes,
		...embeddedOverrides
	} = overrides;

	const base = createBaseEmbeddedConfig();
	const draft: DraftGameConfig = {
		...base,
		...embeddedOverrides,
		items: mergeDraftItems({
			baseItems: base.items,
			overrideItems: embeddedOverrides.items,
		}),
		assets: {
			...base.assets,
			...(embeddedOverrides.assets ?? {}),
		},
		resources: {
			...base.resources,
			...(embeddedOverrides.resources ?? {}),
		},
		effects: {
			...base.effects,
			...(embeddedOverrides.effects ?? {}),
		},
		startingState: embeddedOverrides.startingState ?? base.startingState,
	};

	applyLegacyConfigOverrides({
		craftRecipes: legacyCraftRecipes,
		draft,
		merge: legacyMerge,
		producers: legacyProducers,
		products: legacyProducts,
		stashes: legacyStashes,
	});
	applyEmbeddedMergeRulesFromLegacyIds({
		draft,
		merge: legacyMerge,
	});

	return draft;
};

const createBaseEmbeddedConfig = () => ({
	version: 1 as const,
	game: {
		id: "game:test",
		title: "Test",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			slots: 2,
		},
	},
	resources: {
		"resource:test": {
			data: "x",
		},
	},
	assets: {
		"asset:test": {
			label: "Test",
			render: "plain" as const,
			resourceId: "resource:test",
		},
	},
	items: {
		"item:producer": {
			assetIds: [
				"asset:test",
			],
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			producer: {
				maxQueueSize: 1,
				lines: [
					{
						durationMs: 1000,
						id: "product:test",
						name: "Test product",
						output: [
							{
								itemId: "item:twig",
								quantity: 2,
								type: "guaranteed" as const,
							},
						],
						placement: "board_then_inventory" as const,
					},
					{
						durationMs: 1000,
						id: "product:shred",
						inputs: [
							{
								capacity: 1,
								consume: true,
								itemId: "item:twig",
								quantity: 1,
							},
						],
						name: "Shred",
						placement: "board_then_inventory" as const,
					},
				],
			},
			tags: [],
			tier: 0,
		},
		"item:twig": {
			assetIds: [
				"asset:test",
			],
			description: "Twig",
			maxStackSize: 3,
			merges: [
				{
					resultItemId: "item:plank",
					withItemId: "item:twig",
				},
			],
			name: "Twig",
			tags: [],
			tier: 0,
		},
		"item:plank": {
			assetIds: [
				"asset:test",
			],
			description: "Plank",
			maxStackSize: 2,
			name: "Plank",
			tags: [],
			tier: 1,
		},
		"item:craft-table": {
			assetIds: [
				"asset:test",
			],
			craft: {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:twig",
						quantity: 2,
					},
				],
				resultItemId: "item:plank",
			},
			description: "Craft table",
			maxStackSize: 1,
			name: "Craft Table",
			tags: [],
			tier: 0,
		},
		"item:key": {
			assetIds: [
				"asset:test",
			],
			description: "Key",
			maxStackSize: 3,
			name: "Key",
			tags: [],
			tier: 0,
		},
		"item:stash": {
			assetIds: [
				"asset:test",
			],
			description: "Stash",
			maxStackSize: 1,
			name: "Stash",
			stash: {
				charges: 1,
				line: {
					chargeCost: 1,
					durationMs: 0,
					id: "product:stash",
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:key",
							quantity: 1,
						},
					],
					name: "Open stash",
					output: [
						{
							itemId: "item:twig",
							quantity: 2,
							type: "guaranteed" as const,
						},
					],
					placement: "board_then_inventory" as const,
				},
				maxQueueSize: 1,
				onChargesDepleted: "remove" as const,
			},
			tags: [],
			tier: 0,
		},
		"item:axe": {
			assetIds: [
				"asset:test",
			],
			description: "Axe",
			maxStackSize: 1,
			name: "Axe",
			tags: [],
			tier: 0,
		},
		"item:rock": {
			assetIds: [
				"asset:test",
			],
			description: "Rock",
			maxStackSize: 1,
			name: "Rock",
			removeBy: [
				{
					itemId: "item:axe",
					mode: "keep" as const,
				},
			],
			tags: [],
			tier: 0,
		},
		"item:empty-stash": {
			assetIds: [
				"asset:test",
			],
			description: "Empty stash",
			maxStackSize: 1,
			name: "Empty Stash",
			tags: [],
			tier: 0,
		},
	},
	effects: {},
	startingState: {
		board: [
			{
				itemId: "item:producer",
				x: 0,
				y: 0,
			},
		],
		inventory: [],
	},
});

const mergeDraftItems = ({
	baseItems,
	overrideItems,
}: {
	baseItems: Record<string, unknown>;
	overrideItems?: Record<string, unknown>;
}) => {
	const items = {
		...baseItems,
	};
	for (const [itemId, overrideItem] of Object.entries(overrideItems ?? {})) {
		const baseItem = items[itemId];
		items[itemId] =
			baseItem &&
			typeof baseItem === "object" &&
			!Array.isArray(baseItem) &&
			overrideItem &&
			typeof overrideItem === "object" &&
			!Array.isArray(overrideItem)
				? {
						...baseItem,
						...overrideItem,
					}
				: overrideItem;
	}
	return items;
};

const applyLegacyConfigOverrides = ({
	craftRecipes,
	draft,
	merge,
	producers,
	products,
	stashes,
}: {
	craftRecipes?: LegacyGameConfigViews["craftRecipes"];
	draft: DraftGameConfig;
	merge?: LegacyGameConfigViews["merge"];
	producers?: LegacyGameConfigViews["producers"];
	products?: Record<string, LegacyProductOverride>;
	stashes?: LegacyGameConfigViews["stashes"];
}) => {
	const productCatalog = {
		...readDraftProductLineCatalog(draft),
		...(products ?? {}),
	};

	for (const [itemId, producer] of Object.entries(producers ?? {})) {
		const item = readDraftItem(draft, itemId);
		item.producer = {
			charges: producer.charges,
			maxQueueSize: producer.maxQueueSize ?? 1,
			onChargesDepleted: producer.onChargesDepleted ?? "stop",
			lines: producer.productIds.flatMap((productId) => {
				const product = productCatalog[productId];
				return product
					? [
							{
								...product,
								id: productId,
							},
						]
					: [];
			}),
		};
	}

	for (const [itemId, stash] of Object.entries(stashes ?? {})) {
		const productId = stash.productIds[0];
		const product = productId ? productCatalog[productId] : undefined;
		if (!product) continue;
		const item = readDraftItem(draft, itemId);
		item.stash = {
			charges: stash.charges ?? 1,
			line: {
				...product,
				id: productId,
			},
			maxQueueSize: stash.maxQueueSize ?? 1,
			onChargesDepleted: stash.onChargesDepleted ?? "remove",
		};
	}

	applyLegacyProductOverridesToEmbeddedLines({
		draft,
		products,
	});

	for (const [itemId, craft] of Object.entries(craftRecipes ?? {})) {
		readDraftItem(draft, itemId).craft = craft;
	}
};

const readDraftProductLineCatalog = (draft: DraftGameConfig) => {
	const catalog: Record<string, LegacyProductOverride> = {};
	for (const item of Object.values(draft.items)) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const draftItem = item as Record<string, any>;
		for (const line of draftItem.producer?.lines ?? []) {
			if (line?.id) catalog[line.id] = line;
		}
		const stashLine = draftItem.stash?.line;
		if (stashLine?.id) catalog[stashLine.id] = stashLine;
	}
	return catalog;
};

const applyLegacyProductOverridesToEmbeddedLines = ({
	draft,
	products,
}: {
	draft: DraftGameConfig;
	products?: Record<string, LegacyProductOverride>;
}) => {
	if (!products) return;
	for (const item of Object.values(draft.items)) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const draftItem = item as Record<string, any>;
		if (Array.isArray(draftItem.producer?.lines)) {
			draftItem.producer.lines = draftItem.producer.lines.map((line: any) => {
				const override = line?.id ? products[line.id] : undefined;
				return override
					? {
							...override,
							id: line.id,
						}
					: line;
			});
		}
		const stashLine = draftItem.stash?.line;
		const stashOverride = stashLine?.id ? products[stashLine.id] : undefined;
		if (stashOverride) {
			draftItem.stash.line = {
				...stashOverride,
				id: stashLine.id,
			};
		}
	}
};

const readDraftItem = (
	draft: {
		items: Record<string, unknown>;
	},
	itemId: string,
) => {
	const item = draft.items[itemId];
	if (item && typeof item === "object" && !Array.isArray(item))
		return item as Record<string, unknown>;
	const created = {
		assetIds: [
			"asset:test",
		],
		description: itemId,
		maxStackSize: 1,
		name: itemId,
		tags: [],
		tier: 0,
	};
	draft.items[itemId] = created;
	return created as Record<string, unknown>;
};

const applyEmbeddedMergeRulesFromLegacyIds = ({
	draft,
	merge,
}: {
	draft: {
		items: Record<string, unknown>;
	};
	merge?: LegacyGameConfigViews["merge"];
}) => {
	if (!merge) return;
	for (const item of Object.values(draft.items)) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const draftItem = item as Record<string, unknown>;
		const mergeIds = draftItem.mergeIds;
		if (!Array.isArray(mergeIds)) continue;
		draftItem.merges = mergeIds.flatMap((mergeId) => {
			const rule = typeof mergeId === "string" ? merge[mergeId] : undefined;
			return rule
				? [
						rule,
					]
				: [];
		});
		delete draftItem.mergeIds;
	}
};

const attachLegacyGameConfigViews = (config: EngineTestGameConfig) => {
	const views = readLegacyViews(config);
	Object.defineProperties(config, {
		craftRecipes: {
			value: views.craftRecipes,
		},
		merge: {
			value: views.merge,
		},
		producers: {
			value: views.producers,
		},
		products: {
			value: views.products,
		},
		stashes: {
			value: views.stashes,
		},
	});
	return config;
};

const readLegacyViews = (config: GameConfig): LegacyGameConfigViews => {
	const craftRecipes: LegacyGameConfigViews["craftRecipes"] = {};
	const merge: LegacyGameConfigViews["merge"] = {};
	const producers: LegacyGameConfigViews["producers"] = {};
	const products: LegacyGameConfigViews["products"] = {};
	const stashes: LegacyGameConfigViews["stashes"] = {};

	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.craft) craftRecipes[itemId] = item.craft;
		for (const [mergeIndex, rule] of (item.merges ?? []).entries()) {
			merge[`merge:${itemId}:${mergeIndex}`] = rule;
		}
		if (item.producer) {
			const productIds = item.producer.lines.map((line) => line.id);
			producers[itemId] = {
				charges: item.producer.charges,
				maxQueueSize: item.producer.maxQueueSize,
				onChargesDepleted: item.producer.onChargesDepleted,
				productIds,
			};
			for (const line of item.producer.lines) products[line.id] = line;
		}
		if (item.stash) {
			stashes[itemId] = {
				charges: item.stash.charges,
				maxQueueSize: item.stash.maxQueueSize,
				onChargesDepleted: item.stash.onChargesDepleted,
				productIds: [
					item.stash.line.id,
				],
			};
			products[item.stash.line.id] = item.stash.line;
		}
	}

	return {
		craftRecipes,
		merge,
		producers,
		products,
		stashes,
	};
};
