import { isSpaceRetainedFn } from "~/space/fn/isSpaceRetainedFn";
import { Effect } from "effect";

import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import type { EngineFact } from "~/game-event/type/EngineFact";
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
			readonly EngineFact[],
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
			Effect.map(
				([result, nextRuntime, facts]) =>
					[
						result,
						// Only the final committed transition records history, never draft hops.
						nextRuntime.currentSpace === transition.runtime.currentSpace ||
						!isSpaceRetainedFn({
							space: transition.runtime.currentSpace,
							previousRuntime: transition.runtime,
							runtime: nextRuntime,
						})
							? nextRuntime
							: {
									...nextRuntime,
									previousSpace: transition.runtime.currentSpace,
								},
						facts,
					] as const,
			),
			Effect.tap(([, nextRuntime]) => {
				if (nextRuntime === transition.runtime) return Effect.void;
				return assertRuntimeFx({
					runtime: nextRuntime,
				});
			}),
			Effect.flatMap(([result, nextRuntime, facts = []]) =>
				projectCommittedEngineFactsFx({
					previousRuntime: transition.runtime,
					runtime: nextRuntime,
					facts,
				}).pipe(
					Effect.map((events) => {
						const changed = nextRuntime !== transition.runtime || events.length > 0;
						const nextTransition = changed
							? {
									sequence: transition.sequence + 1,
									previousRuntime: transition.runtime,
									runtime: nextRuntime,
									events,
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
			),
		),
	);
});
