import { Effect } from "effect";

import { modifyRuntimeWithTransitionFx } from "~/game-runtime/fx/modifyRuntimeWithTransitionFx";

/**
 * Runs one runtime mutation against the latest serialized snapshot.
 *
 * Every nested RuntimeFx read observes the same transaction snapshot instead
 * of touching the locked mutable store. The candidate runtime is validated
 * before one committed transition atomically replaces the previous runtime
 * together with the transient events describing that exact mutation.
 */
export const modifyRuntimeFx = Effect.fn("modifyRuntimeFx")(function* <Result, Error, Requirements>(
	updateFx: modifyRuntimeWithTransitionFx.Update<Result, Error, Requirements>,
) {
	const modification = yield* modifyRuntimeWithTransitionFx(updateFx);
	return modification.result;
});
