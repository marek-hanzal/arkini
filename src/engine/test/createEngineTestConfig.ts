import { parseGameConfig, type GameConfig } from "~/config/GameConfigSchema";
import type { GameEffect } from "~/config/readGameConfigEffects";
import type {
	GameCraftRecipeDefinition,
	GameMergeRuleDefinition,
	GameProducerCapabilityDefinition,
	GameProducerDefinition,
	GameLineDefinition,
	GameStashDefinition,
} from "~/config/GameItemCapabilities";

type LineOverride = Omit<Partial<GameLineDefinition>, "effect"> & {
	effect?: GameLineDefinition["effect"];
	id?: string;
};

type ProducerCapabilityOverride = Partial<Omit<GameProducerDefinition, "lines">> & {
	lines?: GameLineDefinition[];
};

type StashCapabilityOverride = Partial<Omit<GameStashDefinition, "line">> & {
	line?: GameLineDefinition;
};

type TestConfigCatalogs = {
	craftCatalog: Record<string, GameCraftRecipeDefinition>;
	lineCatalog: Record<string, GameLineDefinition>;
	mergeCatalog: Record<string, GameMergeRuleDefinition>;
	producerCatalog: Record<string, GameProducerCapabilityDefinition>;
};

type EngineTestGameConfigOverrides = Omit<Partial<GameConfig>, "items"> & {
	craftOverrides?: Record<string, GameCraftRecipeDefinition>;
	items?: Record<string, unknown>;
	itemEffects?: Record<string, readonly GameEffect[]>;
	lineOverrides?: Record<string, LineOverride>;
	producerOverrides?: Record<string, ProducerCapabilityOverride>;
	stashOverrides?: Record<string, StashCapabilityOverride>;
};

type DraftGameConfig = {
	assets: Record<string, unknown>;
	game: unknown;
	items: Record<string, unknown>;
	resources: Record<string, unknown>;
	startingState: unknown;
	version: 1;
};

export type EngineTestGameConfig = GameConfig & TestConfigCatalogs;

export const createEngineTestConfig = (
	overrides: EngineTestGameConfigOverrides = {},
): EngineTestGameConfig => {
	const raw = createEmbeddedTestConfig(overrides);
	const config = parseGameConfig(raw) as EngineTestGameConfig;
	return attachTestConfigCatalogs(config);
};

const createEmbeddedTestConfig = (overrides: EngineTestGameConfigOverrides): unknown => {
	const {
		craftOverrides,
		itemEffects,
		lineOverrides,
		producerOverrides,
		stashOverrides,
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
		startingState: embeddedOverrides.startingState ?? base.startingState,
	};

	applyProducerCapabilityOverrides({
		draft,
		overrides: producerOverrides,
	});
	applyStashCapabilityOverrides({
		draft,
		overrides: stashOverrides,
	});
	applyLineOverrides({
		draft,
		overrides: lineOverrides,
	});
	applyItemEffects({
		draft,
		effectsByItemId: itemEffects,
	});
	applyCraftOverrides({
		draft,
		overrides: craftOverrides,
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
						id: "line:test",
						name: "Test line",
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
						id: "line:shred",
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
					id: "line:stash",
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

const applyItemEffects = ({
	draft,
	effectsByItemId,
}: {
	draft: DraftGameConfig;
	effectsByItemId?: Record<string, readonly GameEffect[]>;
}) => {
	for (const [itemId, effects] of Object.entries(effectsByItemId ?? {})) {
		const item = readDraftItem(draft, itemId);
		const existingEffects = Array.isArray(item.effects)
			? (item.effects as readonly GameEffect[])
			: [];
		const seenEffectIds = new Set(existingEffects.map((effect) => effect.id));
		for (const effect of effects) {
			if (seenEffectIds.has(effect.id)) {
				throw new Error(`Duplicate test item effect "${effect.id}" on "${itemId}".`);
			}
			seenEffectIds.add(effect.id);
		}
		item.effects = [
			...existingEffects,
			...effects,
		];
	}
};

const applyProducerCapabilityOverrides = ({
	draft,
	overrides,
}: {
	draft: DraftGameConfig;
	overrides?: Record<string, ProducerCapabilityOverride>;
}) => {
	for (const [itemId, override] of Object.entries(overrides ?? {})) {
		const item = readDraftItem(draft, itemId);
		const baseProducer = readDraftProducer(item);
		item.producer = {
			...baseProducer,
			...override,
			lines: override.lines ?? baseProducer.lines,
		};
	}
};

const applyStashCapabilityOverrides = ({
	draft,
	overrides,
}: {
	draft: DraftGameConfig;
	overrides?: Record<string, StashCapabilityOverride>;
}) => {
	for (const [itemId, override] of Object.entries(overrides ?? {})) {
		const item = readDraftItem(draft, itemId);
		const baseStash = readDraftStash(item);
		item.stash = {
			...baseStash,
			...override,
			line: override.line ?? baseStash.line,
		};
	}
};

const applyLineOverrides = ({
	draft,
	overrides,
}: {
	draft: DraftGameConfig;
	overrides?: Record<string, LineOverride>;
}) => {
	for (const [lineId, override] of Object.entries(overrides ?? {})) {
		const line = readDraftLine(draft, lineId);
		Object.assign(line, {
			...override,
			id: lineId,
		});
	}
};

const applyCraftOverrides = ({
	draft,
	overrides,
}: {
	draft: DraftGameConfig;
	overrides?: Record<string, GameCraftRecipeDefinition>;
}) => {
	for (const [itemId, craft] of Object.entries(overrides ?? {})) {
		readDraftItem(draft, itemId).craft = craft;
	}
};

const readDraftItem = (draft: DraftGameConfig, itemId: string) => {
	const item = draft.items[itemId];
	if (item && typeof item === "object" && !Array.isArray(item))
		return item as Record<string, any>;
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
	return created as Record<string, any>;
};

const readDraftProducer = (item: Record<string, any>): GameProducerDefinition => {
	if (item.producer) return item.producer;
	return {
		lines: [],
		maxQueueSize: 1,
		onChargesDepleted: "stop",
	};
};

const readDraftStash = (item: Record<string, any>): GameStashDefinition => {
	if (item.stash) return item.stash;
	return {
		charges: 1,
		line: {
			chargeCost: 1,
			durationMs: 0,
			id: "line:stash",
			name: "Open stash",
			placement: "board_then_inventory",
			tags: [],
			visibility: "visible",
		},
		maxQueueSize: 1,
		onChargesDepleted: "remove",
	};
};

const readDraftLine = (draft: DraftGameConfig, lineId: string) => {
	for (const item of Object.values(draft.items)) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const draftItem = item as Record<string, any>;
		for (const line of draftItem.producer?.lines ?? []) {
			if (line?.id === lineId) return line as Record<string, unknown>;
		}
		if (draftItem.stash?.line?.id === lineId)
			return draftItem.stash.line as Record<string, unknown>;
	}
	throw new Error(`Cannot override missing test line "${lineId}".`);
};

const attachTestConfigCatalogs = (config: EngineTestGameConfig) => {
	Object.defineProperties(config, {
		craftCatalog: {
			value: readCraftCatalog(config),
		},
		lineCatalog: {
			value: readLineCatalog(config),
		},
		mergeCatalog: {
			value: readMergeCatalog(config),
		},
		producerCatalog: {
			value: readProducerCatalog(config),
		},
	});
	return config;
};

const readCraftCatalog = (config: GameConfig): Record<string, GameCraftRecipeDefinition> => {
	const catalog: Record<string, GameCraftRecipeDefinition> = {};
	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.craft) catalog[itemId] = item.craft;
	}
	return catalog;
};

const readLineCatalog = (config: GameConfig): Record<string, GameLineDefinition> => {
	const catalog: Record<string, GameLineDefinition> = {};
	for (const item of Object.values(config.items)) {
		for (const line of item.producer?.lines ?? []) catalog[line.id] = line;
		if (item.stash?.line) catalog[item.stash.line.id] = item.stash.line;
	}
	return catalog;
};

const readMergeCatalog = (config: GameConfig): Record<string, GameMergeRuleDefinition> => {
	const catalog: Record<string, GameMergeRuleDefinition> = {};
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const [index, rule] of (item.merges ?? []).entries()) {
			catalog[`${itemId}:${index}`] = rule;
		}
	}
	return catalog;
};

const readProducerCatalog = (
	config: GameConfig,
): Record<string, GameProducerCapabilityDefinition> => {
	const catalog: Record<string, GameProducerCapabilityDefinition> = {};
	for (const [itemId, item] of Object.entries(config.items)) {
		const producer = item.producer ?? item.stash;
		if (producer) catalog[itemId] = producer;
	}
	return catalog;
};
