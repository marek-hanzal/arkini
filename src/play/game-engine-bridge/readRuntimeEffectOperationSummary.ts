import type { GameConfig } from "~/config/GameConfigTypes";
import { readGameConfigEffect } from "~/config/readGameConfigEffects";
import type { EffectiveLine } from "~/effects/EffectiveLine";

export namespace readRuntimeEffectBenefitLines {
	export interface Props {
		config: GameConfig;
		effectId: string;
	}
}

export namespace readRuntimeLineActiveEffectBonusEntries {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		effectiveLine: EffectiveLine;
	}
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatEffectInstanceLabel = ({ count, effectName }: { count: number; effectName: string }) =>
	count > 1 ? `${effectName} ×${count}` : effectName;

const readItemName = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.name ?? itemId;

export const readRuntimeEffectBenefitLines = ({
	config,
	effectId,
}: readRuntimeEffectBenefitLines.Props) => {
	const effect = readGameConfigEffect({
		config,
		effectId,
	});
	if (!effect) return [];
	return effect.grants.map((grant) => grant.name);
};

type EffectInstanceGroup = {
	count: number;
	durationMultiplier?: number;
	effectId: string;
	effectName: string;
	targetItemId?: string;
};

type QuantityRange = {
	max: number;
	min: number;
};

export interface RuntimeLineActiveEffectBonusEntry {
	itemId?: string;
	label: string;
}

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

const readDurationGroupKey = ({
	effectId,
	targetItemId,
}: {
	effectId: string;
	targetItemId?: string;
}) => `${effectId}:${targetItemId ?? "*"}`;

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

		const groupKey = readDurationGroupKey({
			effectId: effect.effectId,
			targetItemId: effect.targetItemId,
		});
		const sourceKey = `${effect.sourceId}:${effect.sourceItemInstanceId}`;
		const existing = groups.get(groupKey);
		if (existing) {
			if (existing.sourceKeys.has(sourceKey)) continue;
			existing.sourceKeys.add(sourceKey);
			existing.count = existing.sourceKeys.size;
			if (effect.durationMultiplier !== undefined) {
				existing.durationMultiplier =
					(existing.durationMultiplier ?? 1) * effect.durationMultiplier;
			}
			continue;
		}

		groups.set(groupKey, {
			count: 1,
			durationMultiplier: effect.durationMultiplier,
			effectId: effect.effectId,
			effectName: effect.effectName,
			sourceKeys: new Set([
				sourceKey,
			]),
			targetItemId: effect.targetItemId,
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

const readAggregatedChanceItemEntries = ({
	config,
	effectiveLine,
}: {
	config: GameConfig;
	effectiveLine: EffectiveLine;
}): RuntimeLineActiveEffectBonusEntry[] => {
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
				return {
					itemId: group.itemId,
					label: `${effectLabel}: +${formatQuantityNumber(guaranteedQuantity)} ${itemName} guaranteed, ${formatPercent(
						remainder,
					)} chance for +${formatQuantityNumber(quantityRange.min)} ${itemName}.`,
				};
			}

			if (guaranteedQuantity > 0) {
				return {
					itemId: group.itemId,
					label: `${effectLabel}: +${formatQuantityNumber(guaranteedQuantity)} ${itemName} guaranteed.`,
				};
			}

			return {
				itemId: group.itemId,
				label: `${effectLabel}: ${formatPercent(chance)} chance for +${formatQuantityNumber(
					firstSuccessMin,
				)} ${itemName}.`,
			};
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
				return {
					itemId: group.itemId,
					label: `${effectLabel}: ${guaranteedPrefix}, ${formatPercent(
						readChanceAtLeastOne(remainderChances),
					)} chance for extra ${itemName} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`,
				};
			}

			if (guaranteedPrefix) {
				return {
					itemId: group.itemId,
					label: `${effectLabel}: ${guaranteedPrefix} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`,
				};
			}
		}

		return {
			itemId: group.itemId,
			label: `${effectLabel}: ${formatPercent(
				readChanceAtLeastOne(group.chances),
			)} chance for at least +${formatQuantityNumber(
				firstSuccessMin,
			)} ${itemName} (${rollCount} rolls, max +${formatQuantityNumber(maxQuantity)}).`,
		};
	});
};

const readDurationEffectBonusEntries = ({
	effectiveLine,
	fallbackDurationRatio,
}: {
	effectiveLine: EffectiveLine;
	fallbackDurationRatio: number;
}): RuntimeLineActiveEffectBonusEntry[] =>
	groupDurationEffectInstances(effectiveLine.appliedEffects).flatMap((group) => {
		const durationRatio = group.durationMultiplier ?? fallbackDurationRatio;
		if (durationRatio === 1) return [];

		const labelPrefix = formatEffectInstanceLabel({
			count: group.count,
			effectName: group.effectName,
		});

		return [
			{
				itemId: group.targetItemId,
				label:
					durationRatio < 1
						? `${labelPrefix}: ${formatPercent(1 - durationRatio)} faster production.`
						: `${labelPrefix}: ${formatPercent(durationRatio - 1)} slower production.`,
			},
		];
	});

export const readRuntimeLineActiveEffectBonusEntries = ({
	baseDurationMs,
	config,
	effectiveLine,
}: readRuntimeLineActiveEffectBonusEntries.Props): RuntimeLineActiveEffectBonusEntry[] => {
	const durationRatio =
		effectiveLine.effectDurationMultiplier ??
		(baseDurationMs > 0 ? effectiveLine.durationMs / baseDurationMs : 1);

	return [
		...readDurationEffectBonusEntries({
			effectiveLine,
			fallbackDurationRatio: durationRatio,
		}),
		...readAggregatedChanceItemEntries({
			config,
			effectiveLine,
		}),
	];
};

export const readRuntimeLineActiveEffectBonusLines = (
	props: readRuntimeLineActiveEffectBonusEntries.Props,
) => readRuntimeLineActiveEffectBonusEntries(props).map((entry) => entry.label);
