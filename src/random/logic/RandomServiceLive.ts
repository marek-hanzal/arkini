import type { RandomService } from "~/random/context/RandomServiceFx";

export const RandomServiceLive: RandomService = {
	float() {
		return Math.random();
	},
	integerInclusive(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	},
	chance(probability) {
		return Math.random() <= probability;
	},
};
