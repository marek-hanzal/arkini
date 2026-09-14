import { Clock, Effect, Exit, Layer, SynchronizedRef } from "effect";

import type { TickPerformance } from "~/game-tick/type/TickPerformance";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { TickFx } from "~/game-tick/service/TickFx";

interface TickCursor {
	readonly observedAtMs: number;
	readonly pendingElapsedMs: number;
}

const makeTickFx = Effect.fn("makeTickFx")(function* (speedUpMultiplier: number) {
	const observedAtMs = yield* Clock.currentTimeMillis;
	const runtimeFx = yield* RuntimeFx;
	const cursor = yield* SynchronizedRef.make<TickCursor>({
		observedAtMs,
		pendingElapsedMs: 0,
	});
	let stableRuntime: RuntimeSchema.Type | null = null;
	const performanceListeners = new Set<(sample: TickPerformance) => void>();
	let windowStartedAtMs = observedAtMs;
	let wakes = 0,
		advances = 0,
		failedAdvances = 0,
		simulationBudgetMs = 0;
	let advanceMs = 0,
		maxAdvanceMs = 0,
		maxWakeGapMs = 0,
		droppedWallMs = 0;

	const advanceRuntime = Effect.uninterruptible(
		SynchronizedRef.modifyEffect(cursor, (state: TickCursor) =>
			Effect.gen(function* () {
				const nowMs = yield* Clock.currentTimeMillis;
				const runtime = yield* runtimeFx.read;
				const accelerated =
					runtime.cheats.enabled &&
					runtime.cheats.speedUpGameplay &&
					speedUpMultiplier > 1;
				const wallStepMs = SimulationStepMs / (accelerated ? speedUpMultiplier : 1);
				const pendingElapsedMs =
					state.pendingElapsedMs + Math.max(0, nowMs - state.observedAtMs);
				const stepsDue = Math.floor(pendingElapsedMs / wallStepMs);
				const next: TickCursor = {
					observedAtMs: Math.max(state.observedAtMs, nowMs),
					pendingElapsedMs: pendingElapsedMs - stepsDue * wallStepMs,
				};
				/* Speed-up is a live authoring aid: publish one ordinary step per wake.
				 * Under load, discard overdue accelerated steps instead of amplifying debt.
				 * Normal gameplay retains complete elapsed-time replay. Neither mode skips
				 * lifecycle operations within a simulation step. */
				const elapsedMs =
					(accelerated ? Math.min(1, stepsDue) : stepsDue) * SimulationStepMs;
				const hasWork = elapsedMs > 0 && runtime !== stableRuntime;
				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						// Only this exact immutable root proves another step is a no-op.
						if (hasWork) {
							const advanced = yield* advanceRuntimeElapsedFx({
								elapsedMs,
							});
							stableRuntime = advanced.stableRuntime;
						}
					}),
				);
				const finishedAtMs = yield* Clock.currentTimeMillis;
				const costMs = Math.max(0, finishedAtMs - nowMs);
				wakes++;
				advances += Number(hasWork);
				failedAdvances += Number(Exit.isFailure(exit));
				simulationBudgetMs += elapsedMs;
				advanceMs += costMs;
				maxAdvanceMs = Math.max(maxAdvanceMs, costMs);
				maxWakeGapMs = Math.max(maxWakeGapMs, nowMs - state.observedAtMs);
				droppedWallMs += accelerated ? Math.max(0, stepsDue - 1) * wallStepMs : 0;
				if (finishedAtMs - windowStartedAtMs >= 1000) {
					const sample: TickPerformance = {
						windowMs: finishedAtMs - windowStartedAtMs,
						wakes,
						advances,
						failedAdvances,
						simulationBudgetMs,
						advanceMs,
						maxAdvanceMs,
						maxWakeGapMs,
						droppedWallMs,
						speedMultiplier: accelerated ? speedUpMultiplier : 1,
						items: runtime.items.length,
						jobs: runtime.jobs.length,
						queuedJobs: runtime.jobQueue.length,
					};
					windowStartedAtMs = finishedAtMs;
					wakes = advances = failedAdvances = simulationBudgetMs = 0;
					advanceMs = maxAdvanceMs = maxWakeGapMs = droppedWallMs = 0;
					for (const listenerFn of performanceListeners) {
						// Observability must never reject or roll back a gameplay step.
						try {
							listenerFn(sample);
						} catch {
							/* Isolate a failed diagnostic sink. */
						}
					}
				}
				// Compensate computation time; even overloaded playback yields to the host.
				const nextDelayMs = Math.max(1, wallStepMs - next.pendingElapsedMs - costMs);
				return [
					Exit.map(exit, () => nextDelayMs),
					next,
				] as const;
			}),
		).pipe(
			Effect.flatMap((exit) =>
				Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
			),
		),
	);
	return {
		advanceRuntime,
		subscribePerformanceFn: (listenerFn: (sample: TickPerformance) => void) => {
			performanceListeners.add(listenerFn);
			return () => {
				performanceListeners.delete(listenerFn);
			};
		},
	};
});

/** Builds Tick over an already-owned canonical Runtime. */
export const TickLayerFx = ({
	speedUpMultiplier = 1,
}: {
	readonly speedUpMultiplier?: number;
} = {}) => Layer.effect(TickFx, makeTickFx(speedUpMultiplier));
