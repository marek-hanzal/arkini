import { Clock, Effect, Exit, SynchronizedRef } from "effect";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TickSchema } from "~/game-tick/schema/TickSchema";
import { TickStepMs } from "~/game-tick/constant/TickStepMs";

interface ElapsedObservation {
	readonly elapsedMs: number;
	readonly observedAtMs: number;
}

interface RuntimeAdvanceResult {
	readonly stableRuntime: RuntimeSchema.Type | null;
}

interface MakeTickServiceProps<Error, Requirements> {
	readonly advanceRuntimeElapsed: (props: {
		readonly elapsedMs: number;
	}) => Effect.Effect<RuntimeAdvanceResult, Error, Requirements>;
}

/** Builds the Tick clock state around an injectable authoritative advancement boundary. */
export const makeTickServiceFx = Effect.fn("makeTickServiceFx")(function* <Error, Requirements>({
	advanceRuntimeElapsed,
}: MakeTickServiceProps<Error, Requirements>) {
	const observedAtMs = yield* Clock.currentTimeMillis;
	const runtimeFx = yield* RuntimeFx;
	const store = yield* SynchronizedRef.make(
		TickSchema.parse({
			observedAtMs,
			pendingElapsedMs: 0,
		}),
	);
	let stableRuntime: RuntimeSchema.Type | null = null;

	const advanceObservedFx = (
		observe: (state: TickSchema.Type) => Effect.Effect<ElapsedObservation>,
		apply: (elapsedMs: number) => Effect.Effect<RuntimeAdvanceResult, Error, Requirements>,
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
							Exit.succeed({
								stableRuntime,
							} satisfies RuntimeAdvanceResult),
							next,
						] as const;
					}
					const runtime = yield* runtimeFx.read;
					/*
					 * Stability is proven only for this exact immutable runtime root.
					 * Any command replaces the root and invalidates the proof; while it
					 * remains identical, replaying another fixed step is the same no-op.
					 */
					if (runtime === stableRuntime) {
						return [
							Exit.succeed({
								stableRuntime,
							} satisfies RuntimeAdvanceResult),
							{
								...next,
								pendingElapsedMs: next.pendingElapsedMs - applicableElapsedMs,
							},
						] as const;
					}
					const exit = yield* Effect.exit(apply(applicableElapsedMs));
					if (Exit.isSuccess(exit)) {
						stableRuntime = exit.value.stableRuntime;
					}
					return [
						exit,
						{
							...next,
							pendingElapsedMs: next.pendingElapsedMs - applicableElapsedMs,
						},
					] as const;
				}),
			).pipe(
				Effect.flatMap((exit) =>
					Exit.isSuccess(exit)
						? Effect.succeed(exit.value)
						: Effect.failCause(exit.cause),
				),
			),
		);

	return {
		read: SynchronizedRef.get(store),
		advanceRuntime: advanceObservedFx(
			(state) =>
				Effect.gen(function* () {
					const nowMs = yield* Clock.currentTimeMillis;
					return {
						elapsedMs: Math.max(0, nowMs - state.observedAtMs),
						observedAtMs: nowMs,
					};
				}),
			(elapsedMs) =>
				advanceRuntimeElapsed({
					elapsedMs,
				}),
		),
		advanceRuntimeBy: (elapsedMs: number) =>
			advanceObservedFx(
				() =>
					Clock.currentTimeMillis.pipe(
						Effect.map((nowMs) => ({
							elapsedMs,
							observedAtMs: nowMs,
						})),
					),
				(pendingElapsedMs) =>
					advanceRuntimeElapsed({
						elapsedMs: pendingElapsedMs,
					}),
			),
	};
});
