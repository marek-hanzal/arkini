import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { assertRuntimeFx } from "~/engine/runtime/check/assertRuntimeFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeStoreFx } from "./RuntimeStoreFx";

type RuntimeUpdateResult<Result> =
	| readonly [
			Result,
			RuntimeSchema.Type,
	  ]
	| readonly [
			Result,
			RuntimeSchema.Type,
			readonly GameEventSchema.Type[],
	  ];

export namespace modifyRuntimeFx {
	export type Update<Result, Error, Requirements> = (
		runtime: RuntimeSchema.Type,
	) => Effect.Effect<RuntimeUpdateResult<Result>, Error, Requirements>;
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
	const store = yield* RuntimeStoreFx;

	return yield* store.modifyEffect((transition) => {
		return update(transition.runtime).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(transition.runtime),
			}),
			Effect.tap(([, nextRuntime]) => {
				if (nextRuntime === transition.runtime) return Effect.void;
				return assertRuntimeFx({
					runtime: nextRuntime,
				});
			}),
			Effect.map(([result, nextRuntime, emittedEvents = []]) => {
				const nextTransition =
					nextRuntime === transition.runtime && emittedEvents.length === 0
						? transition
						: {
								sequence: transition.sequence + 1,
								previousRuntime: transition.runtime,
								runtime: nextRuntime,
								events: [
									...emittedEvents,
								],
							};

				return [
					result,
					nextTransition,
				] as const;
			}),
		);
	});
});
