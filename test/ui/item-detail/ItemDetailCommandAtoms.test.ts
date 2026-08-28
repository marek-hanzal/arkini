import { scheduleTask } from "@effect/atom-react";
import { Cause, Data, Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { createItemDetailCommandAtom } from "~/bridge/item-detail/createItemDetailCommandAtom";

class ExpectedCommandFailure extends Data.TaggedError("ExpectedCommandFailure")<{
	readonly message: string;
}> {}

const makeGame = () =>
	({
		reportCriticalFailure: vi.fn(),
	}) as unknown as GameEngine;

const makeRegistry = () =>
	AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});

describe("Item Detail command authority", () => {
	it("rejects commands while Detail has no visible outcome scope", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const run = vi.fn();
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => undefined,
		});
		const unmount = registry.mount(atom);

		registry.set(atom, {
			key: "line:first",
			action: "autofill",
			failureMessage: "Autofill failed.",
			run: Effect.sync(run),
		});
		await Promise.resolve();

		expect(run).not.toHaveBeenCalled();
		expect(registry.get(atom).pendingActions.size).toBe(0);
		unmount();
		registry.dispose();
	});

	it("publishes pending before even a synchronous command can settle", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const run = vi.fn();
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => "runtime:first",
		});
		const unmount = registry.mount(atom);

		registry.set(atom, {
			key: "line:first",
			action: "enqueue",
			failureMessage: "Start failed.",
			run: Effect.sync(run),
		});

		expect(registry.get(atom).pendingActions.has("line:first")).toBe(true);
		expect(run).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(registry.get(atom).pendingActions.size).toBe(0));
		unmount();
		registry.dispose();
	});

	it("coalesces one exact key while allowing different keys to settle independently", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const first = Effect.runSync(Deferred.make<void>());
		const second = Effect.runSync(Deferred.make<void>());
		const firstRun = vi.fn();
		const duplicateRun = vi.fn();
		const secondRun = vi.fn();
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => "runtime:first",
		});
		const unmount = registry.mount(atom);

		registry.set(atom, {
			key: "line:first",
			action: "autofill",
			failureMessage: "Autofill failed.",
			run: Effect.sync(firstRun).pipe(Effect.andThen(Deferred.await(first))),
		});
		registry.set(atom, {
			key: "line:first",
			action: "autofill",
			failureMessage: "Autofill failed.",
			run: Effect.sync(duplicateRun),
		});
		registry.set(atom, {
			key: "line:second",
			action: "enqueue",
			failureMessage: "Start failed.",
			run: Effect.sync(secondRun).pipe(Effect.andThen(Deferred.await(second))),
		});

		await vi.waitFor(() => {
			expect(firstRun).toHaveBeenCalledOnce();
			expect(secondRun).toHaveBeenCalledOnce();
		});
		expect(duplicateRun).not.toHaveBeenCalled();
		expect(Array.from(registry.get(atom).pendingActions.keys())).toEqual([
			"line:first",
			"line:second",
		]);

		Effect.runSync(Deferred.succeed(first, undefined));
		await vi.waitFor(() =>
			expect(registry.get(atom).pendingActions.has("line:first")).toBe(false),
		);
		expect(registry.get(atom).pendingActions.has("line:second")).toBe(true);
		Effect.runSync(Deferred.succeed(second, undefined));
		await vi.waitFor(() => expect(registry.get(atom).pendingActions.size).toBe(0));
		unmount();
		registry.dispose();
	});

	it("publishes one sole typed failure and clears it on retry admission", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => "runtime:first",
		});
		const unmount = registry.mount(atom);

		registry.set(atom, {
			key: "line:first",
			action: "enqueue",
			failureMessage: "Fallback failure.",
			run: Effect.fail(
				new ExpectedCommandFailure({
					message: "Exact typed failure.",
				}),
			),
		});
		await vi.waitFor(() =>
			expect(registry.get(atom).actionErrors.get("line:first")?.message).toBe(
				"Exact typed failure.",
			),
		);
		expect(game.reportCriticalFailure).not.toHaveBeenCalled();

		const retry = Effect.runSync(Deferred.make<void>());
		registry.set(atom, {
			key: "line:first",
			action: "enqueue",
			failureMessage: "Fallback failure.",
			run: Deferred.await(retry),
		});
		expect(registry.get(atom).actionErrors.has("line:first")).toBe(false);
		Effect.runSync(Deferred.succeed(retry, undefined));
		await vi.waitFor(() => expect(registry.get(atom).pendingActions.size).toBe(0));
		unmount();
		registry.dispose();
	});

	it("does not publish a late failure after the visible target scope changes", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const failure = Effect.runSync(Deferred.make<never, ExpectedCommandFailure>());
		let outcomeScope = "runtime:first";
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => outcomeScope,
		});
		const unmount = registry.mount(atom);
		registry.set(atom, {
			key: "line:first",
			action: "withdraw",
			failureMessage: "Withdraw failed.",
			run: Deferred.await(failure),
		});
		outcomeScope = "runtime:second";
		Effect.runSync(
			Deferred.fail(
				failure,
				new ExpectedCommandFailure({
					message: "Stale failure.",
				}),
			),
		);
		await vi.waitFor(() => expect(registry.get(atom).pendingActions.size).toBe(0));
		expect(registry.get(atom).actionErrors.size).toBe(0);
		unmount();
		registry.dispose();
	});

	it("treats provider teardown interruption as cancellation", async () => {
		const game = makeGame();
		const registry = makeRegistry();
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => "runtime:first",
		});
		const unmount = registry.mount(atom);
		registry.set(atom, {
			key: "line:first",
			action: "withdraw",
			failureMessage: "Withdraw failed.",
			run: Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		});
		await Effect.runPromise(Deferred.await(entered));

		unmount();
		await Effect.runPromise(Deferred.await(interrupted));

		expect(game.reportCriticalFailure).not.toHaveBeenCalled();
		registry.dispose();
	});

	it("fail-stops the exact game and propagates a defect Cause", async () => {
		const game = makeGame();
		const scheduledFailures: unknown[] = [];
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask: (task) => {
				const timeout = setTimeout(() => {
					try {
						task();
					} catch (cause) {
						scheduledFailures.push(cause);
					}
				});
				return () => clearTimeout(timeout);
			},
		});
		const defectCause = Cause.die(new Error("Item Detail command defect"));
		const atom = createItemDetailCommandAtom({
			game,
			readOutcomeScope: () => "runtime:first",
		});
		const unmount = registry.mount(atom);
		registry.set(atom, {
			key: "line:first",
			action: "enqueue",
			failureMessage: "Start failed.",
			run: Effect.failCause(defectCause),
		});

		await vi.waitFor(() => expect(game.reportCriticalFailure).toHaveBeenCalledOnce());
		expect(game.reportCriticalFailure).toHaveBeenCalledWith("game-runtime", defectCause);
		await vi.waitFor(() => expect(scheduledFailures).toContain(defectCause));
		let renderedFailure: unknown;
		try {
			registry.get(atom);
		} catch (cause) {
			renderedFailure = cause;
		}
		expect(renderedFailure).toBe(defectCause);
		unmount();
		registry.dispose();
	});
});
