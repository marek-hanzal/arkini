import { Effect } from "effect";

import { modifyRuntimeWithTransitionFx } from "~/engine/runtime/internal/modifyRuntimeWithTransitionFx";

export namespace modifyRuntimeFx {
	export type Update<Result, Error, Requirements> = modifyRuntimeWithTransitionFx.Update<
		Result,
		Error,
		Requirements
	>;
}

/**
 * Runs one runtime mutation against the latest serialized snapshot.
 *
 * Every nested RuntimeFx read observes the same transaction snapshot instead
 * of touching the locked mutable store. The candidate runtime is validated
 * before one committed transition atomically replaces the previous runtime
 * together with the transient events describing that exact mutation.
 */
export const modifyRuntimeFx = Effect.fn("modifyRuntimeFx")(function* <Result, Error, Requirements>(
	update: modifyRuntimeFx.Update<Result, Error, Requirements>,
) {
	const modification = yield* modifyRuntimeWithTransitionFx(update);
	return modification.result;
});
