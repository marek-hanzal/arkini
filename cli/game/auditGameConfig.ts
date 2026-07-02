import type { GameConfig } from "../../src/config/GameConfigTypes";
import type { GameLineDefinition } from "../../src/config/GameItemCapabilities";

export type GameConfigAuditWarning = {
	code: "duplicate-definition-shape" | "terminal-item" | "unused-definition";
	id: string;
	message: string;
	section: string;
};

type RecordName = "resources" | "assets" | "items";
type UsageIndex = Record<RecordName, Set<string>>;

type ItemFlowIndex = {
	consumedItemIds: Set<string>;
	producedItemIds: Set<string>;
};

type ActivationOutput = NonNullable<GameLineDefinition["output"]>;
type GameDropEffect = NonNullable<
	Extract<
		ActivationOutput[number],
		{
			type: "guaranteed" | "chance";
		}
	>["effects"]
>[number];

export const auditGameConfig = (config: GameConfig): GameConfigAuditWarning[] => {
	const usage = createUsageIndex();
	const itemFlow = createItemFlowIndex();

	collectItemUsage(config, usage, itemFlow);
	collectEffectUsage(config, usage, itemFlow);
	collectStartingStateUsage(config, itemFlow);
	collectUsedAssetDependencyUsage(config, usage);
	collectAssetResourceUsage(config, usage);

	return [
		...readUnusedDefinitionWarnings(config, usage),
		...readTerminalItemWarnings(config, itemFlow, usage),
	].sort(compareGameConfigAuditWarnings);
};

export const formatGameConfigAuditWarnings = (
	warnings: readonly GameConfigAuditWarning[],
): string => {
	if (warnings.length === 0) return "";

	return [
		"Game config warnings:",
		...warnings.map((warning) => `  - [${warning.code}] ${warning.message}`),
	].join("\n");
};

const createUsageIndex = (): UsageIndex => ({
	resources: new Set(),
	assets: new Set(),
	items: new Set(),
});

const createItemFlowIndex = (): ItemFlowIndex => ({
	consumedItemIds: new Set(),
	producedItemIds: new Set(),
});

const collectAssetResourceUsage = (config: GameConfig, usage: UsageIndex) => {
	for (const asset of Object.values(config.assets)) {
		usage.resources.add(asset.resourceId);
	}
};

const collectUsedAssetDependencyUsage = (config: GameConfig, usage: UsageIndex) => {
	const pendingAssetIds = [
		...usage.assets,
	];
	const visitedAssetIds = new Set<string>();

	while (pendingAssetIds.length > 0) {
		const assetId = pendingAssetIds.shift();
		if (!assetId || visitedAssetIds.has(assetId)) continue;

		visitedAssetIds.add(assetId);
		const asset = config.assets[assetId];
		if (!asset) continue;

		if (asset.overlayAssetId) {
			usage.assets.add(asset.overlayAssetId);
			pendingAssetIds.push(asset.overlayAssetId);
		}
	}
};

const collectItemUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const assetId of item.assetIds) usage.assets.add(assetId);

		if ((item.effects ?? []).length > 0) {
			itemFlow.consumedItemIds.add(itemId);
		}

		for (const merge of item.merges ?? []) {
			usage.items.add(merge.withItemId);
			usage.items.add(merge.resultItemId);
			itemFlow.consumedItemIds.add(itemId);
			itemFlow.consumedItemIds.add(merge.withItemId);
			itemFlow.producedItemIds.add(merge.resultItemId);
		}

		for (const removal of item.removeBy ?? []) {
			usage.items.add(removal.itemId);
			itemFlow.consumedItemIds.add(removal.itemId);
			if (removal.output) {
				collectLootOutputUsage(removal.output, itemFlow);
				collectLootOutputEffectUsage(removal.output, config, usage);
			}
		}

		if (item.craft) {
			itemFlow.consumedItemIds.add(itemId);
			usage.items.add(item.craft.resultItemId);
			usageItem(itemFlow, item.craft.resultItemId, "produced");
			for (const input of item.craft.inputs) {
				usage.items.add(input.itemId);
				usageItem(itemFlow, input.itemId, "consumed");
			}
			collectLineEffectUsage(item.craft.effects ?? [], config, usage);
		}

		for (const line of item.producer?.lines ?? []) {
			collectLineUsage(line, config, usage, itemFlow);
		}
		if (item.stash?.line) {
			collectLineUsage(item.stash.line, config, usage, itemFlow);
		}
	}
};

const collectLineUsage = (
	line: GameLineDefinition,
	config: GameConfig,
	usage: UsageIndex,
	itemFlow: ItemFlowIndex,
) => {
	for (const input of line.inputs ?? []) {
		usage.items.add(input.itemId);
		itemFlow.consumedItemIds.add(input.itemId);
	}
	if (line.output) {
		collectLootOutputUsage(line.output, itemFlow);
		collectLootOutputEffectUsage(line.output, config, usage);
	}
};

const readResolvedSelectorIds = (
	selector:
		| {
				mode: "all";
		  }
		| {
				anyOf?: readonly {
					ids: readonly string[];
				}[];
				allOf?: readonly {
					ids: readonly string[];
				}[];
				noneOf?: readonly {
					ids: readonly string[];
				}[];
		  }
		| undefined,
	collection: Readonly<Record<string, unknown>>,
) => {
	const ids = Object.keys(collection);
	if (!selector || "mode" in selector) return ids;
	return ids.filter((id) => doesResolvedSelectorMatchId(id, selector));
};

const doesResolvedSelectorMatchId = (
	id: string,
	selector: {
		anyOf?: readonly {
			ids: readonly string[];
		}[];
		allOf?: readonly {
			ids: readonly string[];
		}[];
		noneOf?: readonly {
			ids: readonly string[];
		}[];
	},
) => {
	if (selector.anyOf && !selector.anyOf.some((clause) => clause.ids.includes(id))) return false;
	if (selector.allOf && !selector.allOf.every((clause) => clause.ids.includes(id))) return false;
	if (selector.noneOf?.some((clause) => clause.ids.includes(id))) return false;
	return true;
};

const collectEffectUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const item of Object.values(config.items)) {
		for (const line of item.producer?.lines ?? []) {
			collectActivationOutputEffectUsage(line.output ?? [], config, usage, itemFlow);
		}
		if (item.stash?.line) {
			collectActivationOutputEffectUsage(
				item.stash.line.output ?? [],
				config,
				usage,
				itemFlow,
			);
		}
		if (item.craft) collectLineEffectUsage(item.craft.effects ?? [], config, usage);
	}
};

const collectActivationOutputEffectUsage = (
	output: ActivationOutput,
	config: GameConfig,
	usage: UsageIndex,
	itemFlow: ItemFlowIndex,
) => {
	for (const entry of output) {
		if (entry.type === "weighted") {
			for (const weightedEntry of entry.entries) {
				collectLineEffectUsage(weightedEntry.effects ?? [], config, usage);
			}
			continue;
		}

		collectLineEffectUsage(entry.effects ?? [], config, usage);
	}
};

const collectLineEffectUsage = (
	effects: readonly {
		kind: string;
		items?: unknown;
	}[],
	config: GameConfig,
	usage: UsageIndex,
) => {
	for (const effect of effects) {
		if (effect.kind === "nearby.require" || effect.kind === "nearby.duration.multiply") {
			for (const itemId of readResolvedSelectorIds(
				effect.items as Parameters<typeof readResolvedSelectorIds>[0],
				config.items,
			)) {
				usage.items.add(itemId);
			}
		}
	}
};

const collectLootOutputEffectUsage = (
	output: ActivationOutput,
	config: GameConfig,
	usage: UsageIndex,
) => {
	for (const entry of output) {
		if (entry.type === "weighted") {
			for (const weightedEntry of entry.entries) {
				collectDropEffectUsage(weightedEntry.effects ?? [], config, usage);
			}
			continue;
		}

		collectDropEffectUsage(entry.effects ?? [], config, usage);
	}
};

const collectDropEffectUsage = (
	effects: readonly GameDropEffect[],
	config: GameConfig,
	usage: UsageIndex,
) => {
	for (const effect of effects) {
		if (effect.kind === "nearby.require" || effect.kind === "nearby.duration.multiply") {
			for (const itemId of readResolvedSelectorIds(
				effect.items as Parameters<typeof readResolvedSelectorIds>[0],
				config.items,
			)) {
				usage.items.add(itemId);
			}
		}

		if (effect.kind === "nearby.loot.outputChance.add") {
			for (const source of effect.sources) {
				for (const itemId of readResolvedSelectorIds(
					source.items as Parameters<typeof readResolvedSelectorIds>[0],
					config.items,
				)) {
					usage.items.add(itemId);
				}
			}
		}
	}
};

const collectLootOutputUsage = (output: ActivationOutput, itemFlow: ItemFlowIndex) => {
	for (const entry of output) {
		if (entry.type === "weighted") {
			for (const weightedEntry of entry.entries) {
				itemFlow.producedItemIds.add(weightedEntry.itemId);
			}
			continue;
		}

		itemFlow.producedItemIds.add(entry.itemId);
	}
};

const collectStartingStateUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const entry of config.startingState.board) itemFlow.producedItemIds.add(entry.itemId);
	for (const entry of config.startingState.inventory) itemFlow.producedItemIds.add(entry.itemId);
};

const readUnusedDefinitionWarnings = (
	config: GameConfig,
	usage: UsageIndex,
): GameConfigAuditWarning[] => [
	...readUnusedRecordWarnings("resources", config.resources, usage.resources),
	...readUnusedRecordWarnings("assets", config.assets, usage.assets),
];

const readTerminalItemWarnings = (
	config: GameConfig,
	itemFlow: ItemFlowIndex,
	usage: UsageIndex,
): GameConfigAuditWarning[] =>
	Object.keys(config.items)
		.filter((itemId) => itemFlow.producedItemIds.has(itemId))
		.filter((itemId) => !itemFlow.consumedItemIds.has(itemId))
		.filter((itemId) => !usage.items.has(itemId))
		.filter((itemId) => !hasConfiguredInteraction(config.items[itemId]))
		.map((itemId) => ({
			code: "terminal-item",
			id: itemId,
			section: "items",
			message: `${itemId} is produced or starts in the save, but no configured input, grant/effect, merge, removal rule, craft, producer, or stash references it.`,
		}));

const readUnusedRecordWarnings = (
	section: Exclude<RecordName, "items">,
	record: Readonly<Record<string, unknown>>,
	usedIds: ReadonlySet<string>,
): GameConfigAuditWarning[] =>
	Object.keys(record)
		.filter((id) => !usedIds.has(id))
		.map((id) => ({
			code: "unused-definition",
			id,
			section,
			message: readUnusedRecordWarningMessage(section, id),
		}));

const readUnusedRecordWarningMessage = (
	section: Exclude<RecordName, "items">,
	id: string,
): string => {
	if (section === "assets")
		return `assets.${id} is defined but no item or used overlay references it.`;
	if (section === "resources")
		return `resources.${id} is packaged from assets but no asset references it.`;
	return `${section}.${id} is defined but no other config entry references it.`;
};

const usageItem = (itemFlow: ItemFlowIndex, itemId: string, usage: "consumed" | "produced") => {
	if (usage === "consumed") {
		itemFlow.consumedItemIds.add(itemId);
		return;
	}

	itemFlow.producedItemIds.add(itemId);
};

const compareGameConfigAuditWarnings = (
	left: GameConfigAuditWarning,
	right: GameConfigAuditWarning,
) => {
	const sectionComparison = left.section.localeCompare(right.section);
	if (sectionComparison !== 0) return sectionComparison;

	const codeComparison = left.code.localeCompare(right.code);
	if (codeComparison !== 0) return codeComparison;

	return left.id.localeCompare(right.id);
};

const hasConfiguredInteraction = (item: GameConfig["items"][string] | undefined) =>
	Boolean(
		item?.producer ||
			item?.stash ||
			item?.craft ||
			(item?.merges && item.merges.length > 0) ||
			(item?.removeBy && item.removeBy.length > 0) ||
			(item?.tags && item.tags.some((tag) => tag.startsWith("special:"))),
	);
