import { Context } from "effect";
import type { RandomService } from "~/v0/random/context/RandomService";

export class RandomServiceFx extends Context.Tag("RandomServiceFx")<
	RandomServiceFx,
	RandomService
>() {
	//
}
