import { Effect } from "effect";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import type { DbHandle } from "./DbHandle";

export const dbFxImpl = Effect.fn("dbFx")(function* <TResult>(
	run: (db: DbHandle) => Promise<TResult>,
) {
	const { kysely } = yield* KyselyContextFx;

	return yield* Effect.tryPromise({
		try() {
			return run(kysely);
		},
		catch: toGameActionError,
	});
});
