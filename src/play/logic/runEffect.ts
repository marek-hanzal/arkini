import { Effect } from "effect";
import { type KyselyContextFx } from "~/database/context/KyselyContextFx";
import { db } from "~/database/local/db";
import { withKysely } from "~/database/logic/withKysely";
import { type RandomServiceFx } from "~/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/random/logic/RandomServiceLive";
import { withRandomService } from "~/random/logic/withRandomService";

export function runEffect<T, E>(effect: Effect.Effect<T, E, KyselyContextFx | RandomServiceFx>) {
	return Effect.runPromise(
		effect.pipe(
			withKysely({
				kysely: db,
				isTransaction: false,
			}),
			withRandomService(RandomServiceLive),
		),
	);
}
