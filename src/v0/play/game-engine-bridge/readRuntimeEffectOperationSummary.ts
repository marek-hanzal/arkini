import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { formatMs } from "~/v0/time/formatMs";

export namespace readRuntimeEffectOperationSummary {
	export interface Props {
		config: GameConfig;
		operation: GameConfig["effects"][string]["operations"][number];
	}
}

export namespace readRuntimeEffectBenefitLines {
	export interface Props {
		config: GameConfig;
		effectId: string;
	}
}

export namespace readRuntimeProductLineActiveEffectBonusLines {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		effectiveProductLine: EffectiveProducerProductLine;
	}
}

type ResolvedDomainSelector =
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
	  };

type ProductLineTarget = {
	producers?: ResolvedDomainSelector;
	productLines?: ResolvedDomainSelector;
};

type ItemTarget = {
	items: ResolvedDomainSelector;
};

const configIdNameFallback = (id: string) =>
	id
		.replace(/^item:/, "")
		.replace(/^producer:/, "")
		.replace(/^product:/, "")
		.replace(/^effect:/, "")
		.replace(/[-:]/g, " ");

const unique = (values: readonly string[]) => [
	...new Set(values),
];

const formatList = (values: readonly string[]) => {
	const visibleValues = values.slice(0, 6);
	const hiddenCount = values.length - visibleValues.length;
	return [
		visibleValues.join(", "),
		hiddenCount > 0 ? `+${hiddenCount} more` : undefined,
	]
		.filter(Boolean)
		.join(" · ");
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatQuantity = (
	quantity:
		| number
		| {
				max: number;
				min: number;
		  },
) => (typeof quantity === "number" ? `${quantity}×` : `${quantity.min}-${quantity.max}×`);

const formatSignedPercent = (value: number) => {
	const prefix = value > 0 ? "+" : "";
	return `${prefix}${formatPercent(value)}`;
};

const formatEffectInstanceLabel = ({ count, effectName }: { count: number; effectName: string }) =>
	count > 1 ? `${effectName} ×${count}` : effectName;

const formatEffectInstanceLabelList = (
	instances: readonly {
		count: number;
		effectName: string;
	}[],
) =>
	formatList(
		instances.map((instance) =>
			formatEffectInstanceLabel({
				count: instance.count,
				effectName: instance.effectName,
			}),
		),
	);

const readSelectorIds = (
	selector: ResolvedDomainSelector | undefined,
	keys: readonly ("anyOf" | "allOf")[],
) => {
	if (!selector || "mode" in selector) return [];

	return unique(keys.flatMap((key) => selector[key]?.flatMap((clause) => clause.ids) ?? []));
};

const readExcludedSelectorIds = (selector: ResolvedDomainSelector | undefined) => {
	if (!selector || "mode" in selector) return [];

	return unique(selector.noneOf?.flatMap((clause) => clause.ids) ?? []);
};

const readResolvedSelectorSummary = ({
	fallbackLabel,
	formatId,
	selector,
}: {
	fallbackLabel: string;
	formatId(id: string): string;
	selector: ResolvedDomainSelector | undefined;
}) => {
	if (!selector) return undefined;
	if ("mode" in selector) return `all ${fallbackLabel}`;

	const includedIds = readSelectorIds(selector, [
		"anyOf",
		"allOf",
	]);
	const excludedIds = readExcludedSelectorIds(selector);
	const includedSummary = includedIds.length
		? formatList(includedIds.map(formatId))
		: `matching ${fallbackLabel}`;
	const excludedSummary = excludedIds.length
		? ` except ${formatList(excludedIds.map(formatId))}`
		: "";

	return `${includedSummary}${excludedSummary}`;
};

const readItemName = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.name ?? configIdNameFallback(itemId);

const readProductLineName = ({ config, productId }: { config: GameConfig; productId: string }) =>
	config.products[productId]?.name ?? configIdNameFallback(productId);

const readProductLineTargetSummary = ({
	config,
	target,
}: {
	config: GameConfig;
	target: ProductLineTarget;
}) => {
	const productLineSummary = readResolvedSelectorSummary({
		fallbackLabel: "product lines",
		formatId: (productId) =>
			readProductLineName({
				config,
				productId,
			}),
		selector: target.productLines,
	});
	const producerSummary = readResolvedSelectorSummary({
		fallbackLabel: "producers",
		formatId: (producerId) =>
			readItemName({
				config,
				itemId: producerId,
			}),
		selector: target.producers,
	});

	if (productLineSummary && producerSummary) {
		return `${productLineSummary} on ${producerSummary}`;
	}

	return productLineSummary ?? producerSummary ?? "matching product lines";
};

const readItemTargetSummary = ({ config, target }: { config: GameConfig; target: ItemTarget }) =>
	readResolvedSelectorSummary({
		fallbackLabel: "items",
		formatId: (itemId) =>
			readItemName({
				config,
				itemId,
			}),
		selector: target.items,
	}) ?? "matching items";

const readTargetSummary = ({
	config,
	target,
}: {
	config: GameConfig;
	target: ProductLineTarget | ItemTarget;
}) => {
	if ("items" in target) {
		return readItemTargetSummary({
			config,
			target,
		});
	}

	return readProductLineTargetSummary({
		config,
		target,
	});
};

const readOutputSummary = ({
	config,
	output,
}: {
	config: GameConfig;
	output: NonNullable<
		Extract<
			GameConfig["effects"][string]["operations"][number],
			{
				kind: "loot.appendOutput" | "loot.replaceOutput";
			}
		>["output"]
	>;
}) =>
	formatList(
		output.flatMap((entry) => {
			if (entry.type === "weighted") {
				return [
					`weighted ${entry.rolls}× from ${formatList(
						entry.entries.map(
							(weightedEntry) =>
								`${formatQuantity(weightedEntry.quantity)} ${readItemName({
									config,
									itemId: weightedEntry.itemId,
								})}`,
						),
					)}`,
				];
			}

			const itemLabel = `${formatQuantity(entry.quantity)} ${readItemName({
				config,
				itemId: entry.itemId,
			})}`;

			if (entry.type === "chance") {
				return [
					`${formatPercent(entry.chance)} chance ${itemLabel}`,
				];
			}

			return [
				itemLabel,
			];
		}),
	);

export const readRuntimeEffectOperationSummary = ({
	config,
	operation,
}: readRuntimeEffectOperationSummary.Props) => {
	const target = readTargetSummary({
		config,
		target: operation.target,
	});

	if (operation.kind === "line.reveal") return `Reveals ${target}.`;
	if (operation.kind === "line.hide") return `Hides ${target}.`;
	if (operation.kind === "line.blockStart") {
		return `Blocks starting ${target}${operation.reason ? `: ${operation.reason}` : ""}.`;
	}
	if (operation.kind === "duration.addMs") {
		if (operation.valueMs < 0) {
			return `Shortens production by ${formatMs(Math.abs(operation.valueMs))} for ${target}.`;
		}

		return `Adds ${formatMs(operation.valueMs)} production time to ${target}.`;
	}
	if (operation.kind === "duration.multiply") {
		if (operation.multiplier < 1) {
			return `${formatPercent(1 - operation.multiplier)} faster production for ${target}.`;
		}
		if (operation.multiplier > 1) {
			return `${formatPercent(operation.multiplier - 1)} slower production for ${target}.`;
		}

		return `Keeps production time unchanged for ${target}.`;
	}
	if (operation.kind === "duration.proximityPenalty") {
		return `Changes proximity time penalty by factor ${operation.durationFactor} for ${target}.`;
	}
	if (operation.kind === "loot.appendOutput") {
		const chance =
			operation.chance === undefined ? "" : ` with ${formatPercent(operation.chance)} chance`;
		return `Adds ${readOutputSummary({
			config,
			output: operation.output,
		})}${chance} to ${target}.`;
	}
	if (operation.kind === "loot.replaceOutput") {
		return `Replaces output with ${readOutputSummary({
			config,
			output: operation.output,
		})} for ${target}.`;
	}
	if (operation.kind === "loot.addChanceItem") {
		return `Adds ${formatPercent(operation.chance)} chance for ${formatQuantity(operation.quantity)} ${readItemName(
			{
				config,
				itemId: operation.itemId,
			},
		)} to ${target}.`;
	}
	if (operation.kind === "loot.dropChance.add") {
		return `${formatSignedPercent(operation.delta)} base drop chance for ${target}.`;
	}
	if (operation.kind === "loot.quantity.add") {
		return `Produces +${operation.value} extra item per output for ${target}.`;
	}
	if (operation.kind === "loot.extraOutputChance.add") {
		return `Adds ${formatPercent(operation.chance)} chance for +${formatQuantity(operation.quantity)} extra output when producing ${readItemTargetSummary(
			{
				config,
				target: operation.outputItems,
			},
		)}.`;
	}

	return `Blocks creating ${target}${operation.reason ? `: ${operation.reason}` : ""}.`;
};

export const readRuntimeEffectBenefitLines = ({
	config,
	effectId,
}: readRuntimeEffectBenefitLines.Props) => {
	const effect = config.effects[effectId];
	if (!effect) return [];

	return effect.operations.map((operation) =>
		readRuntimeEffectOperationSummary({
			config,
			operation,
		}),
	);
};

type EffectInstanceGroup = {
	count: number;
	effectId: string;
	effectName: string;
};

type QuantityRange = {
	max: number;
	min: number;
};

const readQuantityRange = (
	quantity:
		| number
		| {
				max: number;
				min: number;
		  }
		| undefined,
): QuantityRange => {
	if (quantity === undefined) {
		return {
			max: 1,
			min: 1,
		};
	}
	if (typeof quantity === "number") {
		return {
			max: quantity,
			min: quantity,
		};
	}

	return quantity;
};

const formatQuantityNumber = (value: number) => `${value}×`;

const groupDurationEffectInstances = (
	appliedEffects: EffectiveProducerProductLine["appliedEffects"],
): EffectInstanceGroup[] => {
	const groups = new Map<
		string,
		EffectInstanceGroup & {
			sourceKeys: Set<string>;
		}
	>();

	for (const effect of appliedEffects) {
		if (!effect.kind.startsWith("duration.")) continue;

		const groupKey = effect.effectId;
		const sourceKey = `${effect.sourceId}:${effect.sourceItemInstanceId}`;
		const existing = groups.get(groupKey);
		if (existing) {
			existing.sourceKeys.add(sourceKey);
			existing.count = existing.sourceKeys.size;
			continue;
		}

		groups.set(groupKey, {
			count: 1,
			effectId: effect.effectId,
			effectName: effect.effectName,
			sourceKeys: new Set([
				sourceKey,
			]),
		});
	}

	return [
		...groups.values(),
	].map(({ sourceKeys: _sourceKeys, ...group }) => group);
};

const readChanceAtLeastOne = (chances: readonly number[]) =>
	1 - chances.reduce((missChance, chance) => missChance * (1 - chance), 1);

const readAggregatedChanceItemLines = ({
	config,
	effectiveProductLine,
}: {
	config: GameConfig;
	effectiveProductLine: EffectiveProducerProductLine;
}) => {
	const groups = new Map<
		string,
		{
			chances: number[];
			effectId: string;
			effectName: string;
			itemId: string;
			quantityRanges: QuantityRange[];
		}
	>();

	for (const chanceItem of effectiveProductLine.lootPlan.chanceItems) {
		if (!chanceItem.effectId || !chanceItem.effectName) continue;

		const quantityRange = readQuantityRange(chanceItem.quantity);
		const groupKey = [
			chanceItem.effectId,
			chanceItem.itemId,
			quantityRange.min,
			quantityRange.max,
		].join(":");
		const existing = groups.get(groupKey);
		if (existing) {
			existing.chances.push(chanceItem.chance);
			existing.quantityRanges.push(quantityRange);
			continue;
		}

		groups.set(groupKey, {
			chances: [
				chanceItem.chance,
			],
			effectId: chanceItem.effectId,
			effectName: chanceItem.effectName,
			itemId: chanceItem.itemId,
			quantityRanges: [
				quantityRange,
			],
		});
	}

	return [
		...groups.values(),
	].map((group) => {
		const rollCount = group.chances.length;
		const itemName = readItemName({
			config,
			itemId: group.itemId,
		});
		const firstSuccessMin = Math.min(...group.quantityRanges.map((quantity) => quantity.min));
		const maxQuantity = group.quantityRanges.reduce(
			(total, quantity) => total + quantity.max,
			0,
		);
		const effectLabel = formatEffectInstanceLabel({
			count: rollCount,
			effectName: group.effectName,
		});

		if (rollCount === 1) {
			return `${effectLabel}: ${formatPercent(group.chances[0] ?? 0)} chance for +${formatQuantityNumber(
				firstSuccessMin,
			)} ${itemName}.`;
		}

		return `${effectLabel}: ${formatPercent(
			readChanceAtLeastOne(group.chances),
		)} chance for at least +${formatQuantityNumber(
			firstSuccessMin,
		)} ${itemName} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`;
	});
};

export const readRuntimeProductLineActiveEffectBonusLines = ({
	baseDurationMs,
	config,
	effectiveProductLine,
}: readRuntimeProductLineActiveEffectBonusLines.Props) => {
	const chanceItemLines = readAggregatedChanceItemLines({
		config,
		effectiveProductLine,
	});
	const durationEffectInstances = groupDurationEffectInstances(
		effectiveProductLine.appliedEffects,
	);
	const durationRatio = baseDurationMs > 0 ? effectiveProductLine.durationMs / baseDurationMs : 1;
	const durationLine =
		durationEffectInstances.length === 0 || durationRatio === 1
			? undefined
			: durationRatio < 1
				? `${formatEffectInstanceLabelList(durationEffectInstances)}: ${formatPercent(
						1 - durationRatio,
					)} faster production.`
				: `${formatEffectInstanceLabelList(durationEffectInstances)}: ${formatPercent(
						durationRatio - 1,
					)} slower production.`;

	return [
		durationLine,
		...chanceItemLines,
	].filter((line): line is string => Boolean(line));
};
