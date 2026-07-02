import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveLine } from "~/v0/game/effects/EffectiveLine";

export namespace readRuntimeEffectBenefitLines {
	export interface Props {
		config: GameConfig;
		effectId: string;
	}
}

export namespace readRuntimeLineActiveEffectBonusLines {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		effectiveLine: EffectiveLine;
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
	appliedEffects: EffectiveLine["appliedEffects"],
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

const readGuaranteedRollCount = (chance: number) => Math.floor(Math.max(0, chance));

const readChanceRemainder = (chance: number) =>
	Math.max(0, chance - readGuaranteedRollCount(chance));

const readAggregatedChanceItemLines = ({
	config,
	effectiveLine,
}: {
	config: GameConfig;
	effectiveLine: EffectiveLine;
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

	for (const chanceItem of effectiveLine.lootPlan.chanceItems) {
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

		const hasUncappedChance = group.chances.some((chance) => chance > 1);
		if (rollCount === 1) {
			const chance = group.chances[0] ?? 0;
			const quantityRange = group.quantityRanges[0] ?? {
				max: 1,
				min: 1,
			};
			const guaranteedQuantity = readGuaranteedRollCount(chance) * quantityRange.min;
			const remainder = readChanceRemainder(chance);

			if (guaranteedQuantity > 0 && remainder > 0) {
				return `${effectLabel}: +${formatQuantityNumber(guaranteedQuantity)} ${itemName} guaranteed, ${formatPercent(
					remainder,
				)} chance for +${formatQuantityNumber(quantityRange.min)} ${itemName}.`;
			}

			if (guaranteedQuantity > 0) {
				return `${effectLabel}: +${formatQuantityNumber(guaranteedQuantity)} ${itemName} guaranteed.`;
			}

			return `${effectLabel}: ${formatPercent(chance)} chance for +${formatQuantityNumber(
				firstSuccessMin,
			)} ${itemName}.`;
		}

		if (hasUncappedChance) {
			const guaranteedQuantity = group.chances.reduce((total, chance, index) => {
				const quantityRange = group.quantityRanges[index] ?? {
					max: 1,
					min: 1,
				};
				return total + readGuaranteedRollCount(chance) * quantityRange.min;
			}, 0);
			const remainderChances = group.chances
				.map(readChanceRemainder)
				.filter((chance) => chance > 0);
			const guaranteedPrefix =
				guaranteedQuantity > 0
					? `+${formatQuantityNumber(guaranteedQuantity)} ${itemName} guaranteed`
					: undefined;

			if (guaranteedPrefix && remainderChances.length > 0) {
				return `${effectLabel}: ${guaranteedPrefix}, ${formatPercent(
					readChanceAtLeastOne(remainderChances),
				)} chance for extra ${itemName} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`;
			}

			if (guaranteedPrefix) {
				return `${effectLabel}: ${guaranteedPrefix} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`;
			}
		}

		return `${effectLabel}: ${formatPercent(
			readChanceAtLeastOne(group.chances),
		)} chance for at least +${formatQuantityNumber(
			firstSuccessMin,
		)} ${itemName} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`;
	});
};

export const readRuntimeLineActiveEffectBonusLines = ({
	baseDurationMs,
	config,
	effectiveLine,
}: readRuntimeLineActiveEffectBonusLines.Props) => {
	const chanceItemLines = readAggregatedChanceItemLines({
		config,
		effectiveLine,
	});
	const durationEffectInstances = groupDurationEffectInstances(effectiveLine.appliedEffects);
	const durationRatio =
		effectiveLine.effectDurationMultiplier ??
		(baseDurationMs > 0 ? effectiveLine.durationMs / baseDurationMs : 1);
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
