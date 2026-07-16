import type { RandomService } from "~/random/context/RandomService";

export const RandomServiceLive: RandomService = {
	float() {
		return Math.random();
	},
	number(max) {
		return RandomServiceLive.float() * max;
	},
	integerInclusive(min, max) {
		return min + Math.floor(RandomServiceLive.float() * (max - min + 1));
	},
	chance(probability) {
		if (probability <= 0) return false;
		if (probability >= 1) return true;
		return RandomServiceLive.float() < probability;
	},
	weighted(entries, options) {
		const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
		if (total <= 0) return options?.fallback;

		let roll = RandomServiceLive.float() * total;
		for (const entry of entries) {
			roll -= entry.weight;
			if (roll <= 0) return entry;
		}

		return options?.fallback ?? entries.at(-1);
	},
};
