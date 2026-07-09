import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	DropEffect,
	RuntimeItemSelector,
	RuntimeLineEffect,
} from "~/effects/RuntimeLineEffectTypes";
import {
	readNearbyItemSelectorLabel,
	readNearbyLineEffectLabel,
} from "~/effects/readNearbyLineEffectLabel";

type NearbyLootChanceEffect = Extract<
	DropEffect,
	{
		kind: "nearby.loot.outputChance.add";
	}
>;

type NearbyLootChanceSource = NearbyLootChanceEffect["sources"][number];

export const formatChancePercent = (chance: number) => {
	const percent = chance * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

export const readRuntimeLineEffectLabel = ({
	config,
	fallback,
	lineEffect,
}: {
	config: GameConfig;
	fallback: string;
	lineEffect: RuntimeLineEffect;
}) => {
	if (lineEffect.kind === "nearby.require" || lineEffect.kind === "nearby.capacity.spend") {
		return readNearbyLineEffectLabel({
			config,
			lineEffect,
		});
	}
	if (lineEffect.kind === "nearby.duration.multiply") {
		return readNearbyLineEffectLabel({
			config,
			lineEffect,
		});
	}
	return lineEffect.label ?? fallback;
};

export const readNearbyLootChanceSourceLabel = ({
	config,
	source,
}: {
	config: GameConfig;
	source: NearbyLootChanceSource;
}) =>
	source.label ??
	`Nearby ${readNearbyItemSelectorLabel({
		config,
		selector: source.items as RuntimeItemSelector,
	})}`;
