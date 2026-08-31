import { Clock, Effect, Exit, Layer, SynchronizedRef } from "effect";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { TickFx } from "~/game-tick/service/TickFx";

interface TickCursor {
	readonly observedAtMs: number;
	readonly pendingElapsedMs: number;
}

interface RuntimeAdvanceResult {
	readonly stableRuntime: RuntimeSchema.Type | null;
}

const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const observedAtMs = yield* Clock.currentTimeMillis;
	const runtimeFx = yield* RuntimeFx;
	const cursor = yield* SynchronizedRef.make<TickCursor>({
		observedAtMs,
		pendingElapsedMs: 0,
	});
	let stableRuntime: RuntimeSchema.Type | null = null;

	const advanceRuntime = Effect.uninterruptible(
		SynchronizedRef.modifyEffect(cursor, (state: TickCursor) =>
			Effect.gen(function* () {
				const nowMs = yield* Clock.currentTimeMillis;
				const next: TickCursor = {
					observedAtMs: Math.max(state.observedAtMs, nowMs),
					pendingElapsedMs:
						state.pendingElapsedMs + Math.max(0, nowMs - state.observedAtMs),
				};
				const applicableElapsedMs =
					next.pendingElapsedMs - (next.pendingElapsedMs % SimulationStepMs);
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

				const exit = yield* Effect.exit(
					advanceRuntimeElapsedFx({
						elapsedMs: applicableElapsedMs,
					}),
				);
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
				Exit.isSuccess(exit) ? Effect.void : Effect.failCause(exit.cause),
			),
		),
	);

	return {
		advanceRuntime,
	};
});

/** Builds Tick over an already-owned canonical Runtime. */
export const TickLayerFx = Layer.effect(TickFx, makeTickFx());
