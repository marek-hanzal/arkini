import type { RandomService } from "~/random/context/RandomServiceFx";

function float() {
	return Math.random();
}

export const RandomServiceLive: RandomService = {
	float,
	number(max) {
		return float() * max;
	},
	integerInclusive(min, max) {
		return min + Math.floor(float() * (max - min + 1));
	},
	chance(probability) {
		return float() <= probability;
	},
	weighted(entries, options) {
		const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
		if (total <= 0) return options?.fallback;

		let roll = float() * total;
		for (const entry of entries) {
			roll -= entry.weight;
			if (roll <= 0) return entry;
		}

		return options?.fallback ?? entries.at(-1);
	},
};
