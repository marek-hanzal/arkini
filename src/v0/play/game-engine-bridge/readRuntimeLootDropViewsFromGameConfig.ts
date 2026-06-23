import type { ActivationDropView } from "~/v0/board/view/ActivationDropViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace readRuntimeLootDropViewsFromGameConfig {
	export interface Props {
		config: GameConfig;
		lootTableId: string;
	}
}

type LootTable = GameConfig["lootTables"][string];
type LootOutput = LootTable["output"][number];
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

const readWeightedChanceLabel = (entry: WeightedLootEntry, totalWeight: number) => {
	if (totalWeight <= 0) return "0%/roll";
	return `${formatPercent(entry.weight / totalWeight)}/roll`;
};

export const readRuntimeLootDropViewsFromGameConfig = ({
	config,
	lootTableId,
}: readRuntimeLootDropViewsFromGameConfig.Props): ActivationDropView[] => {
	const lootTable = config.lootTables[lootTableId];
	if (!lootTable) return [];

	return lootTable.output.flatMap((output) => {
		if (output.type === "guaranteed") {
			return [
				{
					chanceLabel: "100%",
					itemId: output.itemId,
					quantityLabel: readQuantityLabel(output.quantity),
				},
			];
		}

		if (output.type === "chance") {
			return [
				{
					chanceLabel: formatPercent(output.chance),
					itemId: output.itemId,
					quantityLabel: readQuantityLabel(output.quantity),
				},
			];
		}

		const totalWeight = output.entries.reduce((total, entry) => total + entry.weight, 0);
		const rollLabel = readRollLabel(output.rolls);

		return output.entries.map((entry) => ({
			chanceLabel: readWeightedChanceLabel(entry, totalWeight),
			itemId: entry.itemId,
			quantityLabel: readQuantityLabel(entry.quantity),
			rollLabel,
		}));
	});
};
