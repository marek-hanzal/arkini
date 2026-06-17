import type { RandomService } from "~/v0/random/context/RandomService";
import type { WeightedRandomEntry } from "~/v0/random/context/WeightedRandomEntry";

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
