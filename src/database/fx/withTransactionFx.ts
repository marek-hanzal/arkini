import { Effect } from "effect";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import type { ArkiniDatabase } from "~/database/local/db";
import { withKysely } from "~/database/logic/withKysely";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { withRandomService } from "~/random/logic/withRandomService";
import { dbFx } from "./dbFx";

export const withTransactionFx = Effect.fn("withTransactionFx")(function* <const A, const E>(
	effect: Effect.Effect<A, E, KyselyContextFx | RandomServiceFx>,
) {
	const context = yield* KyselyContextFx;
	const random = yield* RandomServiceFx;

	if (context.isTransaction) {
		return yield* effect;
	}

	return yield* dbFx((kysely) =>
		(kysely as ArkiniDatabase).transaction().execute((tx) =>
			Effect.runPromise(
				effect.pipe(
					withKysely({
						kysely: tx,
						isTransaction: true,
					}),
					withRandomService(random),
				),
			),
		),
	);
});
