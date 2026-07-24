import { Deferred, Effect, Exit, Metric, Scope } from "effect";
import { describe, expect, it } from "vitest";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";

describe("invokeExternalCallbackFx", () => {
	it("interrupts pending PromiseLike work with its owning scope", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				let active = 0;
				let ends = 0;
				let starts = 0;
				const callbackStarted = yield* Deferred.make<void>();
				const ownerScope = yield* Scope.make();
				const metrics: Metric.FiberRuntimeMetricsService = {
					recordFiberEnd: () => {
						active -= 1;
						ends += 1;
					},
					recordFiberStart: () => {
						active += 1;
						starts += 1;
					},
				};

				yield* invokeExternalCallbackFx({
					callback: () => new Promise<void>(() => undefined),
					failureMessage: "Pending callback failed.",
					value: undefined,
				}).pipe(
					Effect.andThen(Deferred.succeed(callbackStarted, undefined)),
					Effect.andThen(Effect.never),
					Effect.provideService(Metric.FiberRuntimeMetrics, metrics),
					Effect.forkIn(ownerScope, {
						startImmediately: true,
					}),
				);
				yield* Deferred.await(callbackStarted);

				const activeBeforeClose = active;
				yield* Scope.close(ownerScope, Exit.void);

				return {
					activeAfterClose: active,
					activeBeforeClose,
					ends,
					starts,
				};
			}),
		);

		expect(result.activeBeforeClose).toBe(1);
		expect(result.activeAfterClose).toBe(0);
		expect(result.starts).toBe(1);
		expect(result.ends).toBe(1);
	});
});
