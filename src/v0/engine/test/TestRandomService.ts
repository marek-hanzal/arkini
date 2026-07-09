import type { RandomService } from "~/random/context/RandomService";
import type { WeightedRandomEntry } from "~/random/context/WeightedRandomEntry";

export const TestRandomService: RandomService = {
	chance() {
		return true;
	},
	float() {
		return 0;
	},
	integerInclusive(min) {
		return min;
	},
	number() {
		return 0;
	},
	weighted<const TEntry extends WeightedRandomEntry>(entries: readonly TEntry[]) {
		return entries[0];
	},
};
