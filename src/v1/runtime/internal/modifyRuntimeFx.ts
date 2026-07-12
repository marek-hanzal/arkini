import { Effect, SynchronizedRef } from "effect";

import { publishGameEventsFx } from "~/v1/event/fx/publishGameEventsFx";
import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { RuntimeStoreFx } from "./RuntimeStoreFx";

export namespace modifyRuntimeFx {
	export type UpdateResult<Result> =
		| readonly [
				Result,
				RuntimeSchema.Type,
		  ]
		| readonly [
				Result,
				RuntimeSchema.Type,
				readonly GameEventSchema.Type[],
		  ];

	export type Update<Result, Error, Requirements> = (
		runtime: RuntimeSchema.Type,
	) => Effect.Effect<UpdateResult<Result>, Error, Requirements>;
}

/**
 * Runs one runtime mutation against the latest serialized snapshot.
 *
 * Every nested RuntimeFx read observes the same transaction snapshot instead
 * of touching the locked mutable store. The candidate runtime is validated
 * before the synchronized reference commits it. Transient events publish only
 * after that successful commit and therefore never describe a rolled-back state.
 */
export const modifyRuntimeFx = <Result, Error, Requirements>(
	update: modifyRuntimeFx.Update<Result, Error, Requirements>,
) => {
	return Effect.gen(function* () {
		const store = yield* RuntimeStoreFx;

		const [result, events] = yield* SynchronizedRef.modifyEffect(store, (runtime) => {
			return update(runtime).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(runtime),
				}),
				Effect.tap(([, nextRuntime]) => {
					return assertRuntimeFx({
						runtime: nextRuntime,
					});
				}),
				Effect.map(
					([value, nextRuntime, emittedEvents = []]) =>
						[
							[
								value,
								emittedEvents,
							] as const,
							nextRuntime,
						] as const,
				),
			);
		});

		const [firstEvent, ...remainingEvents] = events;
		if (firstEvent !== undefined) {
			yield* Effect.uninterruptible(
				publishGameEventsFx({
					events: [
						firstEvent,
						...remainingEvents,
					],
				}),
			);
		}

		return result;
	});
};
