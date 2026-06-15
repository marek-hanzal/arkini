import { Effect } from "effect";
import { IdServiceFx, type IdService } from "~/v0/id/context/IdServiceFx";

export function withIdService(id: IdService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(IdServiceFx, id));
	};
}
