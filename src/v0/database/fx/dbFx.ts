import { Effect } from "effect";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { KyselyContextFx } from "~/v0/database/context/KyselyContextFx";
import { toGameActionError } from "~/v0/play/fx/toGameActionError";
import type { DbHandle } from "./DbHandle";

export namespace dbFx {
	export type Handlers = Partial<Record<string, (error: unknown) => unknown>>;

	export type ErrorChannel<M extends Handlers> = {
		[K in keyof M]: M[K] extends (error: unknown) => infer R ? R : never;
	}[keyof M];
}

const tryDbFx = Effect.fn("dbFx")(function* <TResult, const M extends dbFx.Handlers>(
	run: (db: DbHandle) => Promise<TResult>,
	handler?: M,
) {
	const { kysely } = yield* KyselyContextFx;

	return yield* Effect.tryPromise({
		try() {
			return run(kysely);
		},
		catch(error) {
			const code =
				error && typeof error === "object" && "code" in error
					? String(error.code)
					: undefined;
			const mapped = code ? handler?.[code]?.(error) : undefined;
			if (mapped !== undefined) return mapped;

			return toGameActionError(error);
		},
	});
});

export function dbFx<TResult>(
	run: (db: DbHandle) => Promise<TResult>,
): Effect.Effect<TResult, GameActionError, KyselyContextFx>;
export function dbFx<TResult, const M extends dbFx.Handlers>(
	run: (db: DbHandle) => Promise<TResult>,
	handler: M & dbFx.Handlers,
): Effect.Effect<TResult, GameActionError | dbFx.ErrorChannel<M>, KyselyContextFx>;
export function dbFx(run: (db: DbHandle) => Promise<unknown>, handler?: dbFx.Handlers) {
	return tryDbFx(run, handler);
}
