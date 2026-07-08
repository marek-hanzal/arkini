import type { ActivationDropView } from "~/board/view/ActivationDropViewSchema";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { EffectiveDropEffectOutcome, EffectiveLine } from "~/effects/EffectiveLine";

type LootOutputSet = NonNullable<GameLineDefinition["output"]>[number];
type LootOutput = LootOutputSet["entries"][number];
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

export namespace readRuntimeLootDropViewsFromEffectiveLine {
	export interface Props {
		effectiveLine: EffectiveLine;
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

const readDropEffects = (effects: readonly EffectiveDropEffectOutcome[] | undefined) =>
	effects?.length
		? effects.map((effect) => ({
				active: effect.active,
				impact: effect.impact,
				kind: effect.kind,
				label: effect.label,
				ready: effect.ready,
				result: effect.result,
			}))
		: undefined;

const readDropChanceLabel = ({ chance, enabled }: { chance: number; enabled?: boolean }) =>
	formatPercent(enabled === false ? 0 : chance);

const readWeightedChanceLabel = ({
	enabled,
	entry,
	totalWeight,
}: {
	enabled?: boolean;
	entry: WeightedLootEntry;
	totalWeight: number;
}) => {
	if (enabled === false || totalWeight <= 0) return "0%/roll";
	return `${formatPercent(entry.weight / totalWeight)}/roll`;
};

const isZeroChanceEffectCarrier = (
	entry: Extract<
		LootOutput,
		{
			type: "chance";
		}
	> & {
		dropEffects?: readonly EffectiveDropEffectOutcome[];
		enabled?: boolean;
	},
) =>
	entry.enabled !== false &&
	entry.chance === 0 &&
	(entry.dropEffects ?? []).some((effect) => effect.impact === "chance");

const collectDropViews = ({
	output,
}: {
	output: EffectiveLine["lootPlan"]["visibleOutput"];
}): ActivationDropView[] =>
	output.flatMap((entry) => {
		if (entry.type === "guaranteed") {
			return [
				{
					chanceLabel: readDropChanceLabel({
						chance: 1,
						enabled: entry.enabled,
					}),
					enabled: entry.enabled,
					effects: readDropEffects(entry.dropEffects),
					itemId: entry.itemId,
					quantityLabel: readQuantityLabel(entry.quantity),
				},
			];
		}

		if (entry.type === "chance") {
			if (isZeroChanceEffectCarrier(entry)) return [];

			return [
				{
					chanceLabel: readDropChanceLabel({
						chance: entry.chance,
						enabled: entry.enabled,
					}),
					enabled: entry.enabled,
					effects: readDropEffects(entry.dropEffects),
					itemId: entry.itemId,
					quantityLabel: readQuantityLabel(entry.quantity),
				},
			];
		}

		const totalWeight = entry.entries
			.filter((weightedEntry) => weightedEntry.enabled)
			.reduce((total, weightedEntry) => total + weightedEntry.weight, 0);
		const rollLabel = readRollLabel(entry.rolls);

		return entry.entries.map((weightedEntry) => ({
			chanceLabel: readWeightedChanceLabel({
				enabled: weightedEntry.enabled,
				entry: weightedEntry,
				totalWeight,
			}),
			enabled: weightedEntry.enabled,
			effects: readDropEffects(weightedEntry.dropEffects),
			itemId: weightedEntry.itemId,
			quantityLabel: readQuantityLabel(weightedEntry.quantity),
			rollLabel,
		}));
	});

export const readRuntimeLootDropViewsFromEffectiveLine = ({
	effectiveLine,
}: readRuntimeLootDropViewsFromEffectiveLine.Props): ActivationDropView[] => {
	const drops: ActivationDropView[] = [];
	drops.push(
		...collectDropViews({
			output: effectiveLine.lootPlan.visibleOutput,
		}),
	);

	for (const chanceItem of effectiveLine.lootPlan.chanceItems) {
		drops.push({
			chanceLabel: formatPercent(chanceItem.chance),
			enabled: true,
			effects: readDropEffects(chanceItem.dropEffects),
			itemId: chanceItem.itemId,
			quantityLabel: readQuantityLabel(chanceItem.quantity),
		});
	}

	return drops;
};
