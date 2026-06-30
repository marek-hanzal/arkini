export type EffectDetailPolarity = "buff" | "debuff" | "neutral" | "mixed";

export const effectDetailPolarityTabs: readonly {
	label: string;
	polarity: EffectDetailPolarity;
	title: string;
}[] = [
	{
		label: "Buffs",
		polarity: "buff",
		title: "Buff effects",
	},
	{
		label: "Debuffs",
		polarity: "debuff",
		title: "Debuff effects",
	},
	{
		label: "Neutral",
		polarity: "neutral",
		title: "Neutral effects",
	},
	{
		label: "Mixed",
		polarity: "mixed",
		title: "Mixed effects",
	},
];

export const readEffectDetailPolarityLabel = (polarity: EffectDetailPolarity) =>
	effectDetailPolarityTabs.find((tab) => tab.polarity === polarity)?.label ?? polarity;

export const readEffectDetailPolarityClassName = (polarity: EffectDetailPolarity) => {
	if (polarity === "buff") {
		return "border-emerald-300/55 bg-emerald-400/18 text-emerald-100";
	}
	if (polarity === "debuff") {
		return "border-rose-300/55 bg-rose-400/18 text-rose-100";
	}
	if (polarity === "mixed") {
		return "border-amber-200/55 bg-amber-300/18 text-amber-50";
	}
	return "border-violet-200/50 bg-violet-300/18 text-violet-50";
};
