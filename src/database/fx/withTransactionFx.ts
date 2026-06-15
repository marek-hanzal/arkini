import { Effect } from "effect";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import type { ArkiniDatabase } from "~/database/local/db";
import { withKysely } from "~/database/logic/withKysely";
import { dbFx } from "./dbFx";

export const withTransactionFx = Effect.fn("withTransactionFx")(function* <
	const A,
	const E,
	const R,
>(effect: Effect.Effect<A, E, R>) {
	const context = yield* KyselyContextFx;

	if (context.isTransaction) {
		return yield* effect;
	}

	const trx = yield* dbFx((kysely) => (kysely as ArkiniDatabase).startTransaction().execute());

	return yield* effect.pipe(
		withKysely({
			...context,
			kysely: trx,
			isTransaction: true,
		}),
		Effect.matchEffect({
			onSuccess(value) {
				return dbFx(() => trx.commit().execute()).pipe(Effect.map(() => value));
			},
			onFailure(error) {
				return dbFx(() => trx.rollback().execute()).pipe(
					Effect.flatMap(() => Effect.fail(error)),
				);
			},
		}),
	);
});
