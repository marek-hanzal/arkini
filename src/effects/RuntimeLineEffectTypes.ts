import type { GameLineDefinition } from "~/config/GameItemCapabilities";

type LineOutputSet = NonNullable<GameLineDefinition["output"]>[number];
type LineOutputEntry = LineOutputSet["entries"][number];
type NonWeightedLineOutput = Exclude<
	LineOutputEntry,
	{
		type: "weighted";
	}
>;
export type DropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];
type LineEffect = NonNullable<GameLineDefinition["effects"]>[number];
export type RuntimeLineEffect = DropEffect | LineEffect;
export type NearbyLineEffect = Extract<
	RuntimeLineEffect,
	{
		kind: "nearby.capacity.spend" | "nearby.duration.multiply" | "nearby.require";
	}
>;
export type RuntimeItemSelector = NearbyLineEffect["items"];
