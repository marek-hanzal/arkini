import { Effect } from "effect";
import { type KyselyContext, KyselyContextFx } from "~/v0/database/context/KyselyContextFx";

export function withKysely(kysely: KyselyContext) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(KyselyContextFx, kysely));
	};
}
