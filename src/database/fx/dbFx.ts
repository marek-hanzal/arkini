import { Effect } from "effect";
import type { ArkiniDatabase, ArkiniTransaction } from "~/database/local/db";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import type { GameActionError } from "~/play/logic/playTypes";

export type DbHandle = ArkiniDatabase | ArkiniTransaction;

const dbFxImpl = Effect.fn("dbFx")(function* <TResult>(run: (db: DbHandle) => Promise<TResult>) {
	const { kysely } = yield* KyselyContextFx;

	return yield* Effect.tryPromise({
		try() {
			return run(kysely);
		},
		catch: toGameActionError,
	});
});

export function dbFx<TResult>(
	run: (db: DbHandle) => Promise<TResult>,
): Effect.Effect<TResult, GameActionError, KyselyContextFx> {
	return dbFxImpl(run);
}
