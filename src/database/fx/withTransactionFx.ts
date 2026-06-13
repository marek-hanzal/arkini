import { Effect } from "effect";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { withDateService } from "~/date/logic/withDateService";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import type { ArkiniDatabase } from "~/database/local/db";
import { withKysely } from "~/database/logic/withKysely";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { withIdService } from "~/id/logic/withIdService";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { withGameConfigService } from "~/manifest/logic/withGameConfigService";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { withRandomService } from "~/random/logic/withRandomService";
import { dbFx } from "./dbFx";

export type TransactionServiceFx =
	| DateServiceFx
	| GameConfigServiceFx
	| IdServiceFx
	| KyselyContextFx
	| RandomServiceFx;

export const withTransactionFx = Effect.fn("withTransactionFx")(function* <const A, const E>(
	effect: Effect.Effect<A, E, TransactionServiceFx>,
) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const id = yield* IdServiceFx;
	const context = yield* KyselyContextFx;
	const random = yield* RandomServiceFx;

	if (context.isTransaction) {
		return yield* effect;
	}

	return yield* dbFx((kysely) =>
		(kysely as ArkiniDatabase).transaction().execute((tx) =>
			Effect.runPromise(
				effect.pipe(
					withDateService(date),
					withGameConfigService(gameConfig),
					withIdService(id),
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
