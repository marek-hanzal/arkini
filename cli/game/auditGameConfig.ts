import type { GameConfig } from "../../src/v0/game/config/GameConfigSchema";

export type GameConfigAuditWarning = {
	code: "terminal-item" | "unused-definition";
	id: string;
	message: string;
	section: string;
};

type RecordName =
	| "resources"
	| "assets"
	| "items"
	| "merge"
	| "inputs"
	| "requirements"
	| "producers"
	| "stashes"
	| "craftRecipes"
	| "products"
	| "lootTables";

type UsageIndex = Record<RecordName, Set<string>>;

type ItemFlowIndex = {
	consumedItemIds: Set<string>;
	producedItemIds: Set<string>;
};

export const auditGameConfig = (config: GameConfig): GameConfigAuditWarning[] => {
	const usage = createUsageIndex();
	const itemFlow = createItemFlowIndex();

	collectAssetUsage(config, usage);
	collectItemUsage(config, usage, itemFlow);
	collectMergeUsage(config, usage, itemFlow);
	collectInputUsage(config, itemFlow);
	collectRequirementUsage(config, itemFlow);
	collectProducerUsage(config, usage, itemFlow);
	collectStashUsage(config, usage, itemFlow);
	collectCraftRecipeUsage(config, itemFlow);
	collectProductUsage(config, usage, itemFlow);
	collectLootTableUsage(config, itemFlow);
	collectStartingStateUsage(config, itemFlow);

	return [
		...readUnusedDefinitionWarnings(config, usage),
		...readTerminalItemWarnings(config, itemFlow),
	].sort(compareGameConfigAuditWarnings);
};

export const formatGameConfigAuditWarnings = (
	warnings: readonly GameConfigAuditWarning[],
): string => {
	if (warnings.length === 0) {
		return "";
	}

	return [
		"Game config warnings:",
		...warnings.map((warning) => `  - [${warning.code}] ${warning.message}`),
	].join("\n");
};

const createUsageIndex = (): UsageIndex => ({
	resources: new Set(),
	assets: new Set(),
	items: new Set(),
	merge: new Set(),
	inputs: new Set(),
	requirements: new Set(),
	producers: new Set(),
	stashes: new Set(),
	craftRecipes: new Set(),
	products: new Set(),
	lootTables: new Set(),
});

const createItemFlowIndex = (): ItemFlowIndex => ({
	consumedItemIds: new Set(),
	producedItemIds: new Set(),
});

const collectAssetUsage = (config: GameConfig, usage: UsageIndex) => {
	for (const asset of Object.values(config.assets)) {
		usage.resources.add(asset.resourceId);
		if (asset.overlayAssetId) {
			usage.assets.add(asset.overlayAssetId);
		}
	}
};

const collectItemUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const [itemId, item] of Object.entries(config.items)) {
		usage.assets.add(item.assetId);

		if (item.mergeIds && item.mergeIds.length > 0) {
			itemFlow.consumedItemIds.add(itemId);
		}

		for (const mergeId of item.mergeIds ?? []) {
			usage.merge.add(mergeId);
		}

		if (item.producerId) {
			usage.producers.add(item.producerId);
		}
		if (item.stashId) {
			usage.stashes.add(item.stashId);
		}
		if (item.craftRecipeId) {
			usage.craftRecipes.add(item.craftRecipeId);
		}

		for (const exclusiveItemId of item.exclusiveToIds ?? []) {
			usage.items.add(exclusiveItemId);
			itemFlow.consumedItemIds.add(exclusiveItemId);
		}

		for (const removal of item.removeBy ?? []) {
			usage.items.add(removal.itemId);
			itemFlow.consumedItemIds.add(removal.itemId);
		}
	}
};

const collectMergeUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const merge of Object.values(config.merge)) {
		usage.items.add(merge.withItemId);
		usage.items.add(merge.resultItemId);
		itemFlow.consumedItemIds.add(merge.withItemId);
		itemFlow.producedItemIds.add(merge.resultItemId);
	}
};

const collectInputUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const inputDefinition of Object.values(config.inputs)) {
		for (const input of inputDefinition.inputs) {
			itemFlow.consumedItemIds.add(input.itemId);
		}
	}
};

const collectRequirementUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const requirement of Object.values(config.requirements)) {
		if (requirement.type === "proximity") {
			for (const itemId of requirement.itemIds) {
				itemFlow.consumedItemIds.add(itemId);
			}
			continue;
		}

		itemFlow.consumedItemIds.add(requirement.itemId);
	}
};

const collectProducerUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const producer of Object.values(config.producers)) {
		for (const productId of producer.productIds) {
			usage.products.add(productId);
		}
		for (const requirementId of producer.requirementIds) {
			usage.requirements.add(requirementId);
		}
		collectBlockerItemUsage(producer.blockedBy ?? [], itemFlow);
	}
};

const collectStashUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const stash of Object.values(config.stashes)) {
		usage.lootTables.add(stash.outputTableId);

		for (const input of stash.inputs) {
			itemFlow.consumedItemIds.add(input.itemId);
		}
		for (const requirement of stash.requirements) {
			itemFlow.consumedItemIds.add(requirement.itemId);
		}

		if (typeof stash.onDepleted === "object") {
			usage.items.add(stash.onDepleted.replaceWithItemId);
			itemFlow.producedItemIds.add(stash.onDepleted.replaceWithItemId);
		}
	}
};

const collectCraftRecipeUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const recipe of Object.values(config.craftRecipes)) {
		usageItem(itemFlow, recipe.resultItemId, "produced");
		for (const input of recipe.inputs) {
			usageItem(itemFlow, input.itemId, "consumed");
		}
		for (const requirement of recipe.requirements) {
			usageItem(itemFlow, requirement.itemId, "consumed");
		}
	}
};

const collectProductUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const product of Object.values(config.products)) {
		if (product.inputRefId) {
			usage.inputs.add(product.inputRefId);
		}
		if (product.outputTableId) {
			usage.lootTables.add(product.outputTableId);
		}
		for (const requirementId of product.requirementIds) {
			usage.requirements.add(requirementId);
		}
		collectBlockerItemUsage(product.blockedBy ?? [], itemFlow);
	}
};

const collectBlockerItemUsage = (
	blockers: readonly NonNullable<GameConfig["products"][string]["blockedBy"]>[number][],
	itemFlow: ItemFlowIndex,
) => {
	for (const blocker of blockers) {
		if (blocker.type === "passive") {
			itemFlow.consumedItemIds.add(blocker.itemId);
			continue;
		}

		for (const itemId of blocker.itemIds) {
			itemFlow.consumedItemIds.add(itemId);
		}
	}
};

const collectLootTableUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const lootTable of Object.values(config.lootTables)) {
		for (const output of lootTable.output) {
			if (output.type === "weighted") {
				for (const entry of output.entries) {
					itemFlow.producedItemIds.add(entry.itemId);
				}
				continue;
			}

			itemFlow.producedItemIds.add(output.itemId);
		}
	}
};

const collectStartingStateUsage = (config: GameConfig, itemFlow: ItemFlowIndex) => {
	for (const entry of config.startingState.board) {
		itemFlow.producedItemIds.add(entry.itemId);
	}
	for (const entry of config.startingState.inventory) {
		itemFlow.producedItemIds.add(entry.itemId);
	}
};

const readUnusedDefinitionWarnings = (
	config: GameConfig,
	usage: UsageIndex,
): GameConfigAuditWarning[] => [
	...readUnusedRecordWarnings("merge", config.merge, usage.merge),
	...readUnusedRecordWarnings("inputs", config.inputs, usage.inputs),
	...readUnusedRecordWarnings("requirements", config.requirements, usage.requirements),
	...readUnusedRecordWarnings("producers", config.producers, usage.producers),
	...readUnusedRecordWarnings("stashes", config.stashes, usage.stashes),
	...readUnusedRecordWarnings("craftRecipes", config.craftRecipes, usage.craftRecipes),
	...readUnusedRecordWarnings("products", config.products, usage.products),
	...readUnusedRecordWarnings("lootTables", config.lootTables, usage.lootTables),
];

const readTerminalItemWarnings = (
	config: GameConfig,
	itemFlow: ItemFlowIndex,
): GameConfigAuditWarning[] =>
	Object.keys(config.items)
		.filter((itemId) => itemFlow.producedItemIds.has(itemId))
		.filter((itemId) => !itemFlow.consumedItemIds.has(itemId))
		.filter((itemId) => !hasConfiguredInteraction(config.items[itemId]))
		.map((itemId) => ({
			code: "terminal-item",
			id: itemId,
			section: "items",
			message: `${itemId} is produced or starts in the save, but no configured input, requirement, blocker, exclusive rule, merge, removal rule, craft, or stash references it.`,
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
			message: `${section}.${id} is defined but no other config entry references it.`,
		}));

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
		item?.producerId ||
			item?.stashId ||
			item?.craftRecipeId ||
			(item?.mergeIds && item.mergeIds.length > 0) ||
			(item?.removeBy && item.removeBy.length > 0),
	);
