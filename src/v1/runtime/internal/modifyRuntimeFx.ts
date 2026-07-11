import { Effect, SynchronizedRef } from "effect";

import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { RuntimeStoreFx } from "./RuntimeStoreFx";

export namespace modifyRuntimeFx {
	export type Update<Result, Error, Requirements> = (
		runtime: RuntimeSchema.Type,
	) => Effect.Effect<
		readonly [
			Result,
			RuntimeSchema.Type,
		],
		Error,
		Requirements
	>;
}

/**
 * Runs one runtime mutation against the latest serialized snapshot.
 *
 * Every nested RuntimeFx read observes the same transaction snapshot instead
 * of touching the locked mutable store. The candidate runtime is validated
 * before the synchronized reference commits it.
 */
export const modifyRuntimeFx = <Result, Error, Requirements>(
	update: modifyRuntimeFx.Update<Result, Error, Requirements>,
) => {
	return Effect.gen(function* () {
		const store = yield* RuntimeStoreFx;

		return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
			return update(runtime).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(runtime),
				}),
				Effect.tap(([, nextRuntime]) => {
					return assertRuntimeFx({
						runtime: nextRuntime,
					});
				}),
			);
		});
	});
};
