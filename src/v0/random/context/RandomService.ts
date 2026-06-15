import type { WeightedRandomEntry } from "~/v0/random/context/WeightedRandomEntry";

export namespace RandomService {
	export interface WeightedOptions<TEntry extends WeightedRandomEntry> {
		fallback?: TEntry;
	}
}

export interface RandomService {
	float(): number;
	number(max: number): number;
	integerInclusive(min: number, max: number): number;
	chance(probability: number): boolean;
	weighted<const TEntry extends WeightedRandomEntry>(
		entries: readonly TEntry[],
		options?: RandomService.WeightedOptions<TEntry>,
	): TEntry | undefined;
}
