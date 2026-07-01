import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";

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

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatEffectInstanceLabel = ({ count, effectName }: { count: number; effectName: string }) =>
	count > 1 ? `${effectName} ×${count}` : effectName;

const formatEffectInstanceLabelList = (
	instances: readonly {
		count: number;
		effectName: string;
	}[],
) => instances.map((instance) => formatEffectInstanceLabel(instance)).join(", ");

const readItemName = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.name ?? itemId;

export const readRuntimeEffectBenefitLines = ({
	config,
	effectId,
}: readRuntimeEffectBenefitLines.Props) => {
	const effect = config.effects[effectId];
	if (!effect) return [];
	return effect.grants.map((grant) => grant.name);
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
		if (!effect.kind.includes("duration")) continue;

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
		if (!chanceItem.effectId || !chanceItem.effectName || !chanceItem.dropEffects?.length) {
			continue;
		}

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
	const durationRatio =
		effectiveProductLine.effectDurationMultiplier ??
		(baseDurationMs > 0 ? effectiveProductLine.durationMs / baseDurationMs : 1);
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
