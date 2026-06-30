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
		return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
	}
	if (polarity === "debuff") {
		return "border-rose-400/30 bg-rose-400/10 text-rose-200";
	}
	if (polarity === "mixed") {
		return "border-amber-300/30 bg-amber-300/10 text-amber-100";
	}
	return "border-violet-300/25 bg-violet-300/10 text-violet-100";
};
