import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { assertRuntimeFx } from "~/engine/runtime/check/assertRuntimeFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeStoreFx } from "~/engine/runtime/internal/RuntimeStoreFx";

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

export namespace modifyRuntimeWithTransitionFx {
	export type Update<Result, Error, Requirements> = (
		runtime: RuntimeSchema.Type,
	) => Effect.Effect<RuntimeUpdateResult<Result>, Error, Requirements>;

	export interface Result<Value> {
		readonly result: Value;
		/** Exact transition committed by this mutation, or null when it changed no runtime facts. */
		readonly transition: CommittedTransitionSchema.Type | null;
	}
}

/** Mutates the serialized runtime and returns the exact optional transition from the same lock. */
export const modifyRuntimeWithTransitionFx = Effect.fn("modifyRuntimeWithTransitionFx")(function* <
	Result,
	Error,
	Requirements,
>(update: modifyRuntimeWithTransitionFx.Update<Result, Error, Requirements>) {
	const store = yield* RuntimeStoreFx;

	return yield* store.modifyEffect((transition) =>
		update(transition.runtime).pipe(
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
				const changed = nextRuntime !== transition.runtime || emittedEvents.length > 0;
				const nextTransition = changed
					? {
							sequence: transition.sequence + 1,
							previousRuntime: transition.runtime,
							runtime: nextRuntime,
							events: [
								...emittedEvents,
							],
						}
					: transition;

				return [
					{
						result,
						transition: changed ? nextTransition : null,
					} satisfies modifyRuntimeWithTransitionFx.Result<Result>,
					nextTransition,
				] as const;
			}),
		),
	);
});
