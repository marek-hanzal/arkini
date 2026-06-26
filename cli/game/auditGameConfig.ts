import type { GameConfig } from "../../src/v0/game/config/GameConfigSchema";

export type GameConfigAuditWarning = {
	code: "duplicate-definition-shape" | "terminal-item" | "unused-definition";
	id: string;
	message: string;
	section: string;
};

type RecordName =
	| "resources"
	| "assets"
	| "items"
	| "merge"
	| "requirements"
	| "effects"
	| "producers"
	| "stashes"
	| "craftRecipes"
	| "products";

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
	collectRequirementUsage(config, itemFlow);
	collectEffectUsage(config, usage, itemFlow);
	collectProducerUsage(config, usage, itemFlow);
	collectStashUsage(config, usage, itemFlow);
	collectCraftRecipeUsage(config, itemFlow);
	collectProductUsage(config, usage, itemFlow);
	collectStartingStateUsage(config, itemFlow);

	return [
		...readUnusedDefinitionWarnings(config, usage),
		...readDuplicateDefinitionShapeWarnings(config),
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
	requirements: new Set(),
	effects: new Set(),
	producers: new Set(),
	stashes: new Set(),
	craftRecipes: new Set(),
	products: new Set(),
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

const collectEffectUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const item of Object.values(config.items)) {
		for (const effectId of item.passiveEffectIds ?? []) {
			usage.effects.add(effectId);
		}
	}

	for (const product of Object.values(config.products)) {
		if (product.activatesEffectId) {
			usage.effects.add(product.activatesEffectId);
		}
	}

	for (const effect of Object.values(config.effects)) {
		for (const operation of effect.operations) {
			if (operation.kind === "loot.appendOutput" || operation.kind === "loot.replaceOutput") {
				collectLootOutputUsage(operation.output, itemFlow);
			}

			if (operation.kind === "loot.addChanceItem") {
				usage.items.add(operation.itemId);
				itemFlow.producedItemIds.add(operation.itemId);
			}

			if (operation.kind === "item.blockCreate") {
				for (const itemId of operation.target.itemIds ?? []) {
					usage.items.add(itemId);
					itemFlow.consumedItemIds.add(itemId);
				}
				continue;
			}

			for (const producerId of operation.target.producerIds ?? []) {
				usage.producers.add(producerId);
			}
			for (const productId of operation.target.productIds ?? []) {
				usage.products.add(productId);
			}
		}
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
		collectHindranceItemUsage(producer.hinderedBy ?? [], itemFlow);
	}
};

const collectStashUsage = (config: GameConfig, usage: UsageIndex, itemFlow: ItemFlowIndex) => {
	for (const stash of Object.values(config.stashes)) {
		collectLootOutputUsage(stash.output, itemFlow);

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
		for (const input of product.inputs ?? []) {
			itemFlow.consumedItemIds.add(input.itemId);
		}
		if (product.output) {
			collectLootOutputUsage(product.output, itemFlow);
		}
		for (const requirementId of product.requirementIds) {
			usage.requirements.add(requirementId);
		}
		collectHindranceItemUsage(product.hinderedBy ?? [], itemFlow);
	}
};

const collectHindranceItemUsage = (
	hindrances: readonly NonNullable<GameConfig["products"][string]["hinderedBy"]>[number][],
	itemFlow: ItemFlowIndex,
) => {
	for (const hindrance of hindrances) {
		if (hindrance.type === "passive") {
			itemFlow.consumedItemIds.add(hindrance.itemId);
			continue;
		}

		for (const itemId of hindrance.itemIds) {
			itemFlow.consumedItemIds.add(itemId);
		}
	}
};

const collectLootOutputUsage = (
	output: NonNullable<GameConfig["products"][string]["output"]>,
	itemFlow: ItemFlowIndex,
) => {
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
	for (const entry of config.startingState.board) {
		itemFlow.producedItemIds.add(entry.itemId);
	}
	for (const entry of config.startingState.inventory) {
		itemFlow.producedItemIds.add(entry.itemId);
	}
};

const duplicateShapeSections = [
	"requirements",
	"stashes",
	"craftRecipes",
] as const;

const readDuplicateDefinitionShapeWarnings = (config: GameConfig): GameConfigAuditWarning[] =>
	duplicateShapeSections.flatMap((section) =>
		readDuplicateRecordShapeWarnings(section, config[section]),
	);

const readDuplicateRecordShapeWarnings = (
	section: (typeof duplicateShapeSections)[number],
	record: Readonly<Record<string, unknown>>,
): GameConfigAuditWarning[] => {
	const idsByShape = new Map<string, string[]>();

	for (const [id, value] of Object.entries(record)) {
		const shapeKey = JSON.stringify(omitName(value));
		idsByShape.set(shapeKey, [
			...(idsByShape.get(shapeKey) ?? []),
			id,
		]);
	}

	return [
		...idsByShape.values(),
	]
		.filter((ids) => ids.length > 1)
		.map((ids) => ({
			code: "duplicate-definition-shape" as const,
			id: ids[0] ?? section,
			section,
			message: `${section} definitions share identical gameplay data and should be centralized: ${ids.join(", ")}.`,
		}));
};

const omitName = (value: unknown) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;

	const entries = Object.entries(value).filter(([key]) => key !== "name");

	return Object.fromEntries(entries);
};

const readUnusedDefinitionWarnings = (
	config: GameConfig,
	usage: UsageIndex,
): GameConfigAuditWarning[] => [
	...readUnusedRecordWarnings("merge", config.merge, usage.merge),
	...readUnusedRecordWarnings("requirements", config.requirements, usage.requirements),
	...readUnusedRecordWarnings("effects", config.effects, usage.effects),
	...readUnusedRecordWarnings("producers", config.producers, usage.producers),
	...readUnusedRecordWarnings("stashes", config.stashes, usage.stashes),
	...readUnusedRecordWarnings("craftRecipes", config.craftRecipes, usage.craftRecipes),
	...readUnusedRecordWarnings("products", config.products, usage.products),
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
			message: `${itemId} is produced or starts in the save, but no configured input, requirement, hindrance, effect, merge, removal rule, craft, or stash references it.`,
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
