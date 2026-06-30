export type EffectPolarityUi = "buff" | "debuff" | "neutral" | "mixed";

export const effectPolaritySections: readonly {
	polarity: EffectPolarityUi;
	title: string;
}[] = [
	{
		polarity: "buff",
		title: "Buffs",
	},
	{
		polarity: "debuff",
		title: "Debuffs",
	},
	{
		polarity: "neutral",
		title: "Neutral effects",
	},
	{
		polarity: "mixed",
		title: "Mixed effects",
	},
];

export const readEffectPolarityLabel = (polarity: EffectPolarityUi) => {
	if (polarity === "buff") return "Buff";
	if (polarity === "debuff") return "Debuff";
	if (polarity === "mixed") return "Mixed";
	return "Neutral";
};

export const readEffectPolarityBadgeClassName = (polarity: EffectPolarityUi) => {
	if (polarity === "buff") {
		return "border-ak-success/40 bg-ak-success-soft text-ak-success";
	}
	if (polarity === "debuff") {
		return "border-ak-danger/40 bg-ak-danger-soft text-ak-danger";
	}
	if (polarity === "mixed") {
		return "border-ak-secondary/40 bg-ak-secondary/15 text-ak-secondary";
	}

	return "border-ak-border bg-ak-surface-soft text-ak-text-muted";
};
