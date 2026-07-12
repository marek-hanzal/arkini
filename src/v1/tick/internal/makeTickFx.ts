import { Clock, Effect, Exit, SynchronizedRef } from "effect";

import type { TickFxService } from "~/v1/tick/context/TickFx";
import { advanceRuntimeElapsedFx } from "~/v1/tick/internal/advanceRuntimeElapsedFx";
import { TickStepMs } from "~/v1/tick/TickStepMs";
import { TickSchema } from "~/v1/tick/schema/TickSchema";

interface ElapsedObservation {
	readonly elapsedMs: number;
	readonly observedAtMs: number;
}

const resumeExitFx = <Error>(exit: Exit.Exit<void, Error>) =>
	Exit.isSuccess(exit) ? Effect.succeed(undefined) : Effect.failCause(exit.cause);

/** Builds the transient Tick service owned by one game core layer. */
export const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const observedAtMs = yield* Clock.currentTimeMillis;
	const store = yield* SynchronizedRef.make(
		TickSchema.parse({
			observedAtMs,
			pendingElapsedMs: 0,
		}),
	);

	const advanceObserved = <Error, Requirements>(
		observe: (state: TickSchema.Type) => Effect.Effect<ElapsedObservation>,
		apply: (elapsedMs: number) => Effect.Effect<void, Error, Requirements>,
	) =>
		Effect.uninterruptible(
			SynchronizedRef.modifyEffect(store, (state) =>
				Effect.gen(function* () {
					const observation = yield* observe(state);
					const next = TickSchema.parse({
						observedAtMs: Math.max(state.observedAtMs, observation.observedAtMs),
						pendingElapsedMs: state.pendingElapsedMs + observation.elapsedMs,
					});
					const applicableElapsedMs =
						next.pendingElapsedMs - (next.pendingElapsedMs % TickStepMs);
					if (applicableElapsedMs === 0) {
						return [
							Exit.void,
							next,
						] as const;
					}
					const exit = yield* Effect.exit(apply(applicableElapsedMs));
					return [
						exit,
						Exit.isSuccess(exit)
							? {
									...next,
									pendingElapsedMs: next.pendingElapsedMs - applicableElapsedMs,
								}
							: next,
					] as const;
				}),
			).pipe(Effect.flatMap(resumeExitFx)),
		);

	return {
		read: SynchronizedRef.get(store),
		advanceRuntime: advanceObserved(
			(state) =>
				Clock.currentTimeMillis.pipe(
					Effect.map((nowMs) => ({
						elapsedMs: Math.max(0, nowMs - state.observedAtMs),
						observedAtMs: nowMs,
					})),
				),
			(elapsedMs) =>
				advanceRuntimeElapsedFx({
					elapsedMs,
				}),
		),
		advanceRuntimeBy: (elapsedMs) =>
			advanceObserved(
				() =>
					Clock.currentTimeMillis.pipe(
						Effect.map((nowMs) => ({
							elapsedMs,
							observedAtMs: nowMs,
						})),
					),
				(pendingElapsedMs) =>
					advanceRuntimeElapsedFx({
						elapsedMs: pendingElapsedMs,
					}),
			),
	} satisfies TickFxService;
});
