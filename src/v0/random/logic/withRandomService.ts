import { Effect } from "effect";
import type { RandomService } from "~/v0/random/context/RandomService";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export function withRandomService(random: RandomService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(RandomServiceFx, random));
	};
}
