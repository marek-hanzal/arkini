import { Effect, Exit, Ref } from "effect";
import { describe, expect, it } from "vitest";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { makeTickServiceFx } from "~/engine/tick/internal/makeTickServiceFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

const makeEmptyRuntime = (): RuntimeSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobs: [],
	jobQueue: [],

	defaultLineByOwnerItemId: {},
});

describe("makeTickServiceFx idle scheduling", () => {
	it("accumulates wall time until the exact 100 ms simulation boundary", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtimeRef = yield* Ref.make(makeEmptyRuntime());
				const elapsedBudgets = yield* Ref.make<number[]>([]);
				const tick = yield* makeTickServiceFx({
					advanceRuntimeElapsed: ({ elapsedMs }) =>
						Effect.gen(function* () {
							yield* Ref.update(elapsedBudgets, (budgets) => [
								...budgets,
								elapsedMs,
							]);
							return {
								stableRuntime: yield* Ref.get(runtimeRef),
							};
						}),
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Ref.get(runtimeRef),
					}),
				);

				yield* tick.advanceRuntimeBy(TickStepMs - 1);
				const beforeBoundary = yield* tick.read;
				yield* tick.advanceRuntimeBy(1);

				return {
					beforeBoundary,
					elapsedBudgets: yield* Ref.get(elapsedBudgets),
					state: yield* tick.read,
				};
			}),
		);

		expect(result.beforeBoundary.pendingElapsedMs).toBe(TickStepMs - 1);
		expect(result.elapsedBudgets).toEqual([
			TickStepMs,
		]);
		expect(result.state.pendingElapsedMs).toBe(0);
	});

	it("reuses a stable proof until an external runtime replacement re-arms advancement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtimeRef = yield* Ref.make(makeEmptyRuntime());
				const elapsedBudgets = yield* Ref.make<number[]>([]);
				const tick = yield* makeTickServiceFx({
					advanceRuntimeElapsed: ({ elapsedMs }) =>
						Effect.gen(function* () {
							yield* Ref.update(elapsedBudgets, (budgets) => [
								...budgets,
								elapsedMs,
							]);
							return {
								stableRuntime: yield* Ref.get(runtimeRef),
							};
						}),
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Ref.get(runtimeRef),
					}),
				);

				yield* tick.advanceRuntimeBy(TickStepMs);
				yield* tick.advanceRuntimeBy(TickStepMs * 3);
				const afterStableIdle = yield* Ref.get(elapsedBudgets);

				const replacement = {
					...(yield* Ref.get(runtimeRef)),
				};
				yield* Ref.set(runtimeRef, replacement);
				yield* tick.advanceRuntimeBy(TickStepMs);

				return {
					afterRearm: yield* Ref.get(elapsedBudgets),
					afterStableIdle,
					state: yield* tick.read,
				};
			}),
		);

		expect(result.afterStableIdle).toEqual([
			TickStepMs,
		]);
		expect(result.afterRearm).toEqual([
			TickStepMs,
			TickStepMs,
		]);
		expect(result.state.pendingElapsedMs).toBe(0);
	});

	it("acknowledges the attempted elapsed budget when advancement fails", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtimeRef = yield* Ref.make(makeEmptyRuntime());
				const tick = yield* makeTickServiceFx({
					advanceRuntimeElapsed: () => Effect.fail("broken-runtime"),
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Ref.get(runtimeRef),
					}),
				);

				const exit = yield* Effect.exit(tick.advanceRuntimeBy(TickStepMs * 2));
				return {
					exit,
					state: yield* tick.read,
				};
			}),
		);

		expect(Exit.isFailure(result.exit)).toBe(true);
		expect(result.state.pendingElapsedMs).toBe(0);
	});
});
