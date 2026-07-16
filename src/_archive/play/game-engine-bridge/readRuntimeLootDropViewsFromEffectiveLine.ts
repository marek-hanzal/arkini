import type { ActivationDropView } from "~/board/view/ActivationDropViewSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import {
	readEffectiveLootPlanViewEntries,
	type EffectiveLootPlanViewEntry,
} from "~/effects/readEffectiveLootPlanViewEntries";

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

const readQuantityLabel = (quantity: EffectiveLootPlanViewEntry["quantity"] | undefined) => {
	if (!quantity) return "1";
	if (typeof quantity === "number") return String(quantity);
	if (quantity.min === quantity.max) return String(quantity.min);
	return `${quantity.min}-${quantity.max}`;
};

const readRollLabel = (rolls: EffectiveLootPlanViewEntry["rolls"] | undefined) => {
	if (!rolls) return "1 roll";
	if (typeof rolls === "number") return `${rolls} roll${rolls === 1 ? "" : "s"}`;
	return `${rolls.min}-${rolls.max} rolls`;
};

const readDropEffects = (effects: EffectiveLootPlanViewEntry["effects"] | undefined) =>
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

const readChanceLabel = (entry: EffectiveLootPlanViewEntry) => {
	if (entry.kind === "weighted") {
		return `${formatPercent(entry.probability ?? 0)}/roll`;
	}
	if (entry.kind === "guaranteed") {
		return formatPercent(entry.enabled === false ? 0 : 1);
	}
	return formatPercent(entry.probability ?? 0);
};

const isZeroChanceEffectCarrier = (entry: EffectiveLootPlanViewEntry) =>
	entry.kind === "chance" &&
	entry.enabled !== false &&
	entry.probability === 0 &&
	(entry.effects ?? []).some((effect) => effect.impact === "chance");

const createDropView = (entry: EffectiveLootPlanViewEntry): ActivationDropView => ({
	chanceLabel: readChanceLabel(entry),
	enabled: entry.enabled,
	effects: readDropEffects(entry.effects),
	itemId: entry.itemId,
	quantityLabel: readQuantityLabel(entry.quantity),
	rollLabel: entry.kind === "weighted" ? readRollLabel(entry.rolls) : undefined,
});

const compareEntriesBySourceOrder = (
	left: EffectiveLootPlanViewEntry,
	right: EffectiveLootPlanViewEntry,
) => left.sourceIndex - right.sourceIndex;

export const readRuntimeLootDropViewsFromEffectiveLine = ({
	effectiveLine,
}: readRuntimeLootDropViewsFromEffectiveLine.Props): ActivationDropView[] =>
	readEffectiveLootPlanViewEntries(effectiveLine.lootPlan)
		.filter((entry) => !isZeroChanceEffectCarrier(entry))
		.sort(compareEntriesBySourceOrder)
		.map(createDropView);
