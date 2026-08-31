import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";

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
}

interface RuntimeModification<Value> {
	readonly result: Value;
	/** Exact transition committed by this mutation, or null when it changed no runtime facts. */
	readonly transition: CommittedTransitionSchema.Type | null;
}

/** Mutates the serialized runtime and returns the exact optional transition from the same lock. */
export const modifyRuntimeWithTransitionFx = Effect.fn("modifyRuntimeWithTransitionFx")(function* <
	Result,
	Error,
	Requirements,
>(updateFx: modifyRuntimeWithTransitionFx.Update<Result, Error, Requirements>) {
	const store = yield* RuntimeStoreFx;

	return yield* store.modifyEffectFx((transition) =>
		updateFx(transition.runtime).pipe(
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
					} satisfies RuntimeModification<Result>,
					nextTransition,
				] as const;
			}),
		),
	);
});
