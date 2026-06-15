import { Effect } from "effect";
import { HashServiceFx, type HashService } from "~/v0/hash/context/HashServiceFx";

export function withHashService(hash: HashService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(HashServiceFx, hash));
	};
}
