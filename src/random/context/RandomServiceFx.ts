import { Context } from "effect";

export interface RandomService {
	float(): number;
	integerInclusive(min: number, max: number): number;
	chance(probability: number): boolean;
}

export class RandomServiceFx extends Context.Tag("RandomServiceFx")<
	RandomServiceFx,
	RandomService
>() {
	//
}
