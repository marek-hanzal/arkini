import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import { type RuntimeItemSelector } from "~/effects/readNearbyLineEffectMatches";
import {
	readNearbyItemSelectorLabel,
	readNearbyLineEffectLabel,
} from "~/effects/readNearbyLineEffectLabel";

type LineOutput = NonNullable<GameLineDefinition["output"]>[number];
type NonWeightedLineOutput = Exclude<
	LineOutput,
	{
		type: "weighted";
	}
>;
type DropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];
type LineEffect = NonNullable<GameLineDefinition["effects"]>[number];
export type RuntimeLineEffect = DropEffect | LineEffect;

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
