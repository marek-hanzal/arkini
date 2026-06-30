import type { ActivationDropView } from "~/v0/board/view/ActivationDropViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";

type LootOutput = NonNullable<GameConfig["products"][string]["output"]>[number];
type LootQuantity = NonNullable<
	Extract<
		LootOutput,
		{
			quantity?: unknown;
		}
	>["quantity"]
>;
type WeightedLootEntry = Extract<
	LootOutput,
	{
		type: "weighted";
	}
>["entries"][number];

export namespace readRuntimeLootDropViewsFromEffectiveProductLine {
	export interface Props {
		effectiveProductLine: EffectiveProducerProductLine;
	}
}

const formatPercent = (value: number) => {
	const percent = value * 100;
	if (percent >= 10) return `${Math.round(percent)}%`;
	return `${Number(percent.toFixed(1))}%`;
};

const readQuantityLabel = (quantity: LootQuantity | undefined) => {
	if (!quantity) return "1";
	if (typeof quantity === "number") return String(quantity);
	if (quantity.min === quantity.max) return String(quantity.min);
	return `${quantity.min}-${quantity.max}`;
};

const readRollLabel = (rolls: LootQuantity | undefined) => {
	if (!rolls) return "1 roll";
	if (typeof rolls === "number") return `${rolls} roll${rolls === 1 ? "" : "s"}`;
	return `${rolls.min}-${rolls.max} rolls`;
};

const readWeightedChanceLabel = ({
	entry,
	totalWeight,
}: {
	entry: WeightedLootEntry;
	totalWeight: number;
}) => {
	if (totalWeight <= 0) return "0%/roll";
	return `${formatPercent(entry.weight / totalWeight)}/roll`;
};

const collectDropViews = ({
	output,
}: {
	output: NonNullable<GameConfig["products"][string]["output"]>;
}): ActivationDropView[] =>
	output.flatMap((entry) => {
		if (entry.type === "guaranteed") {
			return [
				{
					chanceLabel: formatPercent(1),
					itemId: entry.itemId,
					quantityLabel: readQuantityLabel(entry.quantity),
				},
			];
		}

		if (entry.type === "chance") {
			return [
				{
					chanceLabel: formatPercent(entry.chance),
					itemId: entry.itemId,
					quantityLabel: readQuantityLabel(entry.quantity),
				},
			];
		}

		const totalWeight = entry.entries.reduce(
			(total, weightedEntry) => total + weightedEntry.weight,
			0,
		);
		const rollLabel = readRollLabel(entry.rolls);

		return entry.entries.map((weightedEntry) => ({
			chanceLabel: readWeightedChanceLabel({
				entry: weightedEntry,
				totalWeight,
			}),
			itemId: weightedEntry.itemId,
			quantityLabel: readQuantityLabel(weightedEntry.quantity),
			rollLabel,
		}));
	});

export const readRuntimeLootDropViewsFromEffectiveProductLine = ({
	effectiveProductLine,
}: readRuntimeLootDropViewsFromEffectiveProductLine.Props): ActivationDropView[] => {
	const drops: ActivationDropView[] = [];
	drops.push(
		...collectDropViews({
			output: effectiveProductLine.lootPlan.baseOutput,
		}),
	);

	for (const chanceItem of effectiveProductLine.lootPlan.chanceItems) {
		drops.push({
			chanceLabel: formatPercent(chanceItem.chance),
			itemId: chanceItem.itemId,
			quantityLabel: readQuantityLabel(chanceItem.quantity),
		});
	}

	return drops;
};
