import { Context } from "effect";
import type { RandomService } from "~/random/context/RandomService";

export class RandomServiceFx extends Context.Tag("RandomServiceFx")<
	RandomServiceFx,
	RandomService
>() {
	//
}
