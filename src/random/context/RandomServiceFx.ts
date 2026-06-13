import { Context } from "effect";

export interface WeightedRandomEntry {
	weight: number;
}

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

export class RandomServiceFx extends Context.Tag("RandomServiceFx")<
	RandomServiceFx,
	RandomService
>() {
	//
}
