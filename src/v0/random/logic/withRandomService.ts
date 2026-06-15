import { Effect } from "effect";
import { RandomServiceFx, type RandomService } from "~/v0/random/context/RandomServiceFx";

export function withRandomService(random: RandomService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(RandomServiceFx, random));
	};
}
