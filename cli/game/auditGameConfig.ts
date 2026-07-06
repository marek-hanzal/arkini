import type { GameConfig } from "../../src/config/GameConfigTypes";
import type { GameLineDefinition } from "../../src/config/GameItemCapabilities";
import { GAME_WELL_KNOWN_ASSET_IDS } from "../../src/config/GameWellKnownAssetIds";

export type GameConfigAuditWarning = {
	code:
		| "duplicate-definition-shape"
		| "limited-deposit-softlock"
		| "limited-deposit-stochastic-softlock"
		| "terminal-item"
		| "unused-definition";
	id: string;
	message: string;
	section: string;
};

export type GameConfigAuditSummary = {
	assets: number;
	boardCells: number;
	crafts: number;
	items: number;
	limitedDeposits: number;
	producerLines: number;
	producers: number;
	resources: number;
	startingBoardItems: number;
	startingInventoryItems: number;
	stochasticCapacitySpendLines: number;
};

export type GameConfigAuditLimitedDepositReport = {
	id: string;
	max: number;
	onDepleted: ItemCapacity["onDepleted"];
	replaceItemId?: string;
	spentByLineIds: string[];
	stochasticSpendLineIds: string[];
	sustainableReplacement: boolean;
};

export type GameConfigAuditReport = {
	limitedDeposits: GameConfigAuditLimitedDepositReport[];
	summary: GameConfigAuditSummary;
	warnings: GameConfigAuditWarning[];
};

type RecordName = "resources" | "assets" | "items";
type ItemCapacity = NonNullable<GameConfig["items"][string]["capacity"]>;
type UsageIndex = Record<RecordName, Set<string>>;

type ItemFlowIndex = {
	consumedItemIds: Set<string>;
	producedItemIds: Set<string>;
};

type ItemProductionRule = {
	dependencies: ReadonlySet<string>;
	producedItemIds: ReadonlySet<string>;
};

type CapacitySpendLine = {
	lineId: string;
	ownerItemId: string;
	spentItemIds: readonly string[];
	stochasticOnly: boolean;
};

type LimitedDepositIndex = {
	capacitySpendLines: CapacitySpendLine[];
	productionRules: ItemProductionRule[];
	spentCapacityItemIds: Set<string>;
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

export const auditGameConfig = (config: GameConfig): GameConfigAuditWarning[] =>
	auditGameConfigReport(config).warnings;

export const auditGameConfigReport = (config: GameConfig): GameConfigAuditReport => {
	const usage = createUsageIndex();
	const itemFlow = createItemFlowIndex();
	const limitedDeposits = createLimitedDepositIndex();

	collectItemUsage(config, usage, itemFlow, limitedDeposits);
	collectWellKnownAssetUsage(usage);
	collectEffectUsage(config, usage);
	collectStartingStateUsage(config, itemFlow);
	collectUsedAssetDependencyUsage(config, usage);
	collectAssetResourceUsage(config, usage);

	const sustainableItemIds = readSustainableItemIds(limitedDeposits.productionRules);
	const warnings = [
		...readUnusedDefinitionWarnings(config, usage),
		...readTerminalItemWarnings(config, itemFlow, usage),
		...readLimitedDepositSoftlockWarnings(config, limitedDeposits, sustainableItemIds),
		...readLimitedDepositStochasticSoftlockWarnings(config, limitedDeposits),
	].sort(compareGameConfigAuditWarnings);

	return {
		limitedDeposits: readLimitedDepositReports({
			config,
			limitedDeposits,
			sustainableItemIds,
		}),
		summary: readGameConfigAuditSummary(config, limitedDeposits),
		warnings,
	};
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

export const formatGameConfigAuditReport = (report: GameConfigAuditReport): string => {
	const summary = report.summary;
	const lines = [
		"Game config report:",
		"  Summary:",
		`    items: ${summary.items}`,
		`    assets: ${summary.assets}`,
		`    resources: ${summary.resources}`,
		`    board cells: ${summary.boardCells}`,
		`    starting board items: ${summary.startingBoardItems}`,
		`    starting inventory stacks: ${summary.startingInventoryItems}`,
		`    producers/stashes: ${summary.producers}`,
		`    producer/stash lines: ${summary.producerLines}`,
		`    craft recipes: ${summary.crafts}`,
		`    limited deposits: ${summary.limitedDeposits}`,
		`    stochastic capacity spend lines: ${summary.stochasticCapacitySpendLines}`,
	];

	if (report.limitedDeposits.length > 0) {
		lines.push("", "  Limited deposits:");
		for (const deposit of report.limitedDeposits) {
			lines.push(
				`    - ${deposit.id}: max ${deposit.max}, ${formatLimitedDepositDepletion(deposit)}, sustainable ${formatBoolean(deposit.sustainableReplacement)}`,
			);
			if (deposit.spentByLineIds.length > 0) {
				lines.push(`      spent by: ${deposit.spentByLineIds.join(", ")}`);
			}
			if (deposit.stochasticSpendLineIds.length > 0) {
				lines.push(`      RNG risk lines: ${deposit.stochasticSpendLineIds.join(", ")}`);
			}
		}
	}

	if (report.warnings.length > 0) {
		lines.push("", formatGameConfigAuditWarnings(report.warnings));
	}

	return lines.join("\n");
};

const formatLimitedDepositDepletion = (deposit: GameConfigAuditLimitedDepositReport): string => {
	if (deposit.onDepleted === "replace") return `replaces with ${deposit.replaceItemId}`;
	return `onDepleted ${deposit.onDepleted}`;
};

const formatBoolean = (value: boolean): string => (value ? "yes" : "no");

const createUsageIndex = (): UsageIndex => ({
	resources: new Set(),
	assets: new Set(),
	items: new Set(),
});

const createItemFlowIndex = (): ItemFlowIndex => ({
	consumedItemIds: new Set(),
	producedItemIds: new Set(),
});

const createLimitedDepositIndex = (): LimitedDepositIndex => ({
	capacitySpendLines: [],
	productionRules: [],
	spentCapacityItemIds: new Set(),
});

const collectWellKnownAssetUsage = (usage: UsageIndex) => {
	for (const assetId of GAME_WELL_KNOWN_ASSET_IDS) {
		usage.assets.add(assetId);
	}
};

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

const collectItemUsage = (
	config: GameConfig,
	usage: UsageIndex,
	itemFlow: ItemFlowIndex,
	limitedDeposits: LimitedDepositIndex,
) => {
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const assetId of item.assetIds) usage.assets.add(assetId);

		if ((item.effects ?? []).length > 0) {
			itemFlow.consumedItemIds.add(itemId);
		}

		for (const merge of item.merges ?? []) {
			usage.items.add(merge.withItemId);
			itemFlow.consumedItemIds.add(itemId);
			itemFlow.consumedItemIds.add(merge.withItemId);
			if ("resultItemId" in merge) {
				usage.items.add(merge.resultItemId);
				itemFlow.producedItemIds.add(merge.resultItemId);
				limitedDeposits.productionRules.push({
					dependencies: new Set([
						itemId,
						merge.withItemId,
					]),
					producedItemIds: new Set([
						merge.resultItemId,
					]),
				});
			}
			if (merge.output) {
				collectLootOutputUsage(merge.output, itemFlow);
				collectProductionRule(limitedDeposits, merge.output, [
					itemId,
					merge.withItemId,
				]);
				collectLootOutputEffectUsage(merge.output, config, usage);
			}
		}

		for (const removal of item.removeBy ?? []) {
			usage.items.add(removal.itemId);
			itemFlow.consumedItemIds.add(removal.itemId);
			if (removal.output) {
				collectLootOutputUsage(removal.output, itemFlow);
				collectProductionRule(limitedDeposits, removal.output, [
					itemId,
					removal.itemId,
				]);
				collectLootOutputEffectUsage(removal.output, config, usage);
			}
		}

		if (item.craft) {
			itemFlow.consumedItemIds.add(itemId);
			usage.items.add(item.craft.resultItemId);
			usageItem(itemFlow, item.craft.resultItemId, "produced");
			limitedDeposits.productionRules.push({
				dependencies: new Set([
					itemId,
					...item.craft.inputs
						.filter((input) => input.consume)
						.map((input) => input.itemId),
				]),
				producedItemIds: new Set([
					item.craft.resultItemId,
				]),
			});
			for (const input of item.craft.inputs) {
				usage.items.add(input.itemId);
				if (input.consume) usageItem(itemFlow, input.itemId, "consumed");
			}
			collectLineEffectUsage(item.craft.effects ?? [], config, usage);
		}

		for (const line of item.producer?.lines ?? []) {
			collectLineUsage(itemId, line, config, usage, itemFlow, limitedDeposits);
		}
		if (item.stash?.line) {
			collectLineUsage(itemId, item.stash.line, config, usage, itemFlow, limitedDeposits);
		}
	}
};

const collectLineUsage = (
	ownerItemId: string,
	line: GameLineDefinition,
	config: GameConfig,
	usage: UsageIndex,
	itemFlow: ItemFlowIndex,
	limitedDeposits: LimitedDepositIndex,
) => {
	for (const input of line.inputs ?? []) {
		usage.items.add(input.itemId);
		itemFlow.consumedItemIds.add(input.itemId);
	}
	const spentCapacityItemIds = readLineSpentCapacityItemIds(config, line);

	if (line.output) {
		collectLootOutputUsage(line.output, itemFlow);
		collectProductionRule(limitedDeposits, line.output, [
			...(line.inputs ?? []).filter((input) => input.consume).map((input) => input.itemId),
			...spentCapacityItemIds,
		]);
		collectLootOutputEffectUsage(line.output, config, usage);
	}

	for (const itemId of spentCapacityItemIds) {
		limitedDeposits.spentCapacityItemIds.add(itemId);
	}

	if (spentCapacityItemIds.length > 0) {
		limitedDeposits.capacitySpendLines.push({
			lineId: line.id,
			ownerItemId,
			spentItemIds: spentCapacityItemIds,
			stochasticOnly: !line.output || !hasGuaranteedOutput(line.output),
		});
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

const collectEffectUsage = (config: GameConfig, usage: UsageIndex) => {
	for (const item of Object.values(config.items)) {
		for (const line of item.producer?.lines ?? []) {
			collectActivationOutputEffectUsage(line.output ?? [], config, usage);
		}
		if (item.stash?.line) {
			collectActivationOutputEffectUsage(item.stash.line.output ?? [], config, usage);
		}
		if (item.craft) collectLineEffectUsage(item.craft.effects ?? [], config, usage);
	}
};

const collectActivationOutputEffectUsage = (
	output: ActivationOutput,
	config: GameConfig,
	usage: UsageIndex,
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

const collectProductionRule = (
	limitedDeposits: LimitedDepositIndex,
	output: ActivationOutput,
	dependencies: readonly string[],
) => {
	const producedItemIds = readLootOutputItemIds(output);
	if (producedItemIds.size === 0) return;

	limitedDeposits.productionRules.push({
		dependencies: new Set(dependencies),
		producedItemIds,
	});
};

const readLootOutputItemIds = (output: ActivationOutput): Set<string> => {
	const itemIds = new Set<string>();

	for (const entry of output) {
		if (entry.type === "weighted") {
			for (const weightedEntry of entry.entries) itemIds.add(weightedEntry.itemId);
			continue;
		}

		itemIds.add(entry.itemId);
	}

	return itemIds;
};

const readLineSpentCapacityItemIds = (config: GameConfig, line: GameLineDefinition): string[] =>
	(line.effects ?? [])
		.filter((effect) => effect.kind === "nearby.capacity.spend")
		.flatMap((effect) =>
			readResolvedSelectorIds(
				effect.items as Parameters<typeof readResolvedSelectorIds>[0],
				config.items,
			),
		);

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

const readLimitedDepositSoftlockWarnings = (
	config: GameConfig,
	limitedDeposits: LimitedDepositIndex,
	sustainableItemIds: ReadonlySet<string>,
): GameConfigAuditWarning[] => {
	const riskyDepositIds = new Set(
		Object.entries(config.items)
			.filter(([, item]) => item.capacity && item.capacity.onDepleted !== "stop")
			.map(([itemId]) => itemId),
	);
	return [
		...limitedDeposits.spentCapacityItemIds,
	]
		.filter((itemId) => riskyDepositIds.has(itemId))
		.filter(
			(itemId) =>
				!hasSustainableDepositReplacement({
					config,
					itemId,
					productionRules: limitedDeposits.productionRules,
					sustainableItemIds,
				}),
		)
		.map((itemId) => ({
			code: "limited-deposit-softlock",
			id: itemId,
			section: "items",
			message: `${itemId} has finite capacity that can be depleted by producer lines, but no sustainable production or replacement path recreates it. This may softlock production once the deposit disappears.`,
		}));
};

const readLimitedDepositStochasticSoftlockWarnings = (
	config: GameConfig,
	limitedDeposits: LimitedDepositIndex,
): GameConfigAuditWarning[] => {
	const warningByItemId = new Map<string, GameConfigAuditWarning>();

	for (const spendLine of limitedDeposits.capacitySpendLines) {
		if (!spendLine.stochasticOnly) continue;

		for (const itemId of spendLine.spentItemIds) {
			const item = config.items[itemId];
			if (!item?.capacity || item.capacity.onDepleted === "stop") continue;
			if (warningByItemId.has(itemId)) continue;

			warningByItemId.set(itemId, {
				code: "limited-deposit-stochastic-softlock",
				id: itemId,
				section: "items",
				message: `${itemId} is finite capacity spent by ${spendLine.ownerItemId}.${spendLine.lineId}, but that line has no guaranteed output. Bad RNG can drain the deposit without giving progression items.`,
			});
		}
	}

	return [
		...warningByItemId.values(),
	];
};

const readLimitedDepositReports = ({
	config,
	limitedDeposits,
	sustainableItemIds,
}: {
	config: GameConfig;
	limitedDeposits: LimitedDepositIndex;
	sustainableItemIds: ReadonlySet<string>;
}): GameConfigAuditLimitedDepositReport[] =>
	Object.entries(config.items)
		.filter(([, item]) => item.capacity)
		.map(([itemId, item]) => {
			const capacity = item.capacity as ItemCapacity;
			const spentByLines = limitedDeposits.capacitySpendLines.filter((line) =>
				line.spentItemIds.includes(itemId),
			);
			const sustainableReplacement = hasSustainableDepositReplacement({
				config,
				itemId,
				productionRules: limitedDeposits.productionRules,
				sustainableItemIds,
			});

			return {
				id: itemId,
				max: capacity.max,
				onDepleted: capacity.onDepleted,
				replaceItemId:
					capacity.onDepleted === "replace" ? capacity.replaceItemId : undefined,
				spentByLineIds: spentByLines.map(formatCapacitySpendLineId).sort(),
				stochasticSpendLineIds: spentByLines
					.filter((line) => line.stochasticOnly)
					.map(formatCapacitySpendLineId)
					.sort(),
				sustainableReplacement,
			};
		})
		.sort((left, right) => left.id.localeCompare(right.id));

const readGameConfigAuditSummary = (
	config: GameConfig,
	limitedDeposits: LimitedDepositIndex,
): GameConfigAuditSummary => {
	const producerItems = Object.values(config.items).filter((item) => item.producer);
	const stashItems = Object.values(config.items).filter((item) => item.stash);
	const producerLines = producerItems.reduce(
		(total, item) => total + (item.producer?.lines.length ?? 0),
		0,
	);
	const stashLines = stashItems.reduce((total, item) => total + (item.stash?.line ? 1 : 0), 0);

	return {
		assets: Object.keys(config.assets).length,
		boardCells: config.game.board.width * config.game.board.height,
		crafts: Object.values(config.items).filter((item) => item.craft).length,
		items: Object.keys(config.items).length,
		limitedDeposits: Object.values(config.items).filter((item) => item.capacity).length,
		producerLines: producerLines + stashLines,
		producers: producerItems.length + stashItems.length,
		resources: Object.keys(config.resources).length,
		startingBoardItems: config.startingState.board.length,
		startingInventoryItems: config.startingState.inventory.length,
		stochasticCapacitySpendLines: limitedDeposits.capacitySpendLines.filter(
			(line) => line.stochasticOnly,
		).length,
	};
};

const hasGuaranteedOutput = (output: ActivationOutput): boolean =>
	output.some((entry) => entry.type === "guaranteed" && entry.enabled !== false);

const formatCapacitySpendLineId = (line: CapacitySpendLine): string =>
	`${line.ownerItemId}.${line.lineId}`;

const readSustainableItemIds = (productionRules: readonly ItemProductionRule[]) => {
	const sustainableItemIds = new Set<string>();
	let changed = true;

	while (changed) {
		changed = false;

		for (const rule of productionRules) {
			if (
				![
					...rule.dependencies,
				].every((itemId) => sustainableItemIds.has(itemId))
			)
				continue;

			for (const itemId of rule.producedItemIds) {
				if (sustainableItemIds.has(itemId)) continue;
				sustainableItemIds.add(itemId);
				changed = true;
			}
		}
	}

	return sustainableItemIds;
};

const hasSustainableDepositReplacement = ({
	config,
	itemId,
	productionRules,
	sustainableItemIds,
}: {
	config: GameConfig;
	itemId: string;
	productionRules: readonly ItemProductionRule[];
	sustainableItemIds: ReadonlySet<string>;
}) => {
	if (sustainableItemIds.has(itemId)) return true;

	const capacity: ItemCapacity | undefined = config.items[itemId]?.capacity;
	if (!capacity || capacity.onDepleted !== "replace") return false;

	return canReplacementRegrowItem({
		itemId,
		productionRules,
		replaceItemId: capacity.replaceItemId,
		sustainableItemIds,
	});
};

const canReplacementRegrowItem = ({
	itemId,
	productionRules,
	replaceItemId,
	sustainableItemIds,
}: {
	itemId: string;
	productionRules: readonly ItemProductionRule[];
	replaceItemId: string;
	sustainableItemIds: ReadonlySet<string>;
}) => {
	const availableItemIds = new Set([
		...sustainableItemIds,
		replaceItemId,
	]);
	let changed = true;

	while (changed) {
		if (availableItemIds.has(itemId)) return true;
		changed = false;

		for (const rule of productionRules) {
			if (
				![
					...rule.dependencies,
				].every((dependencyItemId) => availableItemIds.has(dependencyItemId))
			)
				continue;

			for (const producedItemId of rule.producedItemIds) {
				if (availableItemIds.has(producedItemId)) continue;
				availableItemIds.add(producedItemId);
				changed = true;
			}
		}
	}

	return availableItemIds.has(itemId);
};

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
		return `assets.${id} is defined but no item, well-known game surface, or used overlay references it.`;
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
