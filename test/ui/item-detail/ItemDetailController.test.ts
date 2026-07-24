// @vitest-environment jsdom

import { Cause, Data, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";
import type { ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";

class ExpectedItemDetailFailure extends Data.TaggedError("ExpectedItemDetailFailure")<{
	readonly message: string;
}> {}

const runtimeTarget = ({
	itemId = "runtime:first",
	tab = "lines",
	origin = null,
}: {
	readonly itemId?: string;
	readonly tab?: "info" | "lines" | "queue" | "sources";
	readonly origin?: HTMLElement | null;
} = {}) =>
	({
		kind: "runtime",
		itemId,
		tab,
		origin,
	}) satisfies ItemDetailTarget;

describe("ItemDetailController", () => {
	it("owns same-tick lifecycle, origin retention, and generation-safe exit settlement", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribe(listener);

		expect(
			Effect.runSync(
				controller.openTargetFx(
					runtimeTarget({
						origin,
					}),
				),
			),
		).toBe(true);
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		expect(controller.readOrigin(document.createElement("button"))).toBe(origin);

		Effect.runSync(controller.completeEnterFx(entering.generation + 1));
		expect(controller.getSnapshot().state.phase).toBe("entering");
		Effect.runSync(controller.completeEnterFx(entering.generation));
		expect(controller.getSnapshot().state.phase).toBe("open");

		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					tab: "info",
					origin: controller.readOrigin(null),
				}),
			),
		);
		expect(controller.getSnapshot().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				tab: "info",
				origin,
			},
		});

		let firstSettled = false;
		let secondSettled = false;
		const firstClose = Effect.runPromise(controller.closeFx()).then(() => {
			firstSettled = true;
		});
		const secondClose = Effect.runPromise(
			controller.closeFx({
				restoreFocus: false,
			}),
		).then(() => {
			secondSettled = true;
		});
		expect(controller.getSnapshot().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
		});

		await Promise.resolve();
		expect(firstSettled).toBe(false);
		expect(secondSettled).toBe(false);
		Effect.runSync(controller.completeExitFx(entering.generation + 1));
		expect(controller.getSnapshot().state.phase).toBe("exiting");
		Effect.runSync(controller.completeExitFx(entering.generation));
		await Promise.all([
			firstClose,
			secondClose,
		]);
		expect(firstSettled).toBe(true);
		expect(secondSettled).toBe(true);
		expect(controller.getSnapshot().state).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(6);
	});

	it("retains command ownership across tab remounts and scopes failures to one target", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));
		const deferred = Effect.runSync(Deferred.make<never, Error>());
		const entered = vi.fn();
		const run = Effect.sync(entered).pipe(Effect.andThen(Deferred.await(deferred)));

		const outcome = Effect.runPromiseExit(
			controller.runPendingActionFx({
				key: "line:first",
				action: "default",
				failureMessage: "Default failed.",
				run,
			}),
		);
		void Effect.runPromise(
			controller.runPendingActionFx({
				key: "line:first",
				action: "start",
				failureMessage: "Start failed.",
				run,
			}),
		);
		expect(entered).toHaveBeenCalledOnce();
		expect(controller.readPendingAction("line:first")).toBe("default");

		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					tab: "info",
					origin: controller.readOrigin(null),
				}),
			),
		);
		expect(controller.readPendingAction("line:first")).toBe("default");
		const failure = new Error("Deferred failure.");
		Effect.runSync(Deferred.fail(deferred, failure));
		const commandExit = await outcome;
		expect(Exit.isFailure(commandExit)).toBe(true);
		if (Exit.isSuccess(commandExit)) throw new Error("Expected command failure.");
		expect(Cause.findErrorOption(commandExit.cause)).toEqual(Option.some(failure));
		expect(controller.readPendingAction("line:first")).toBeNull();
		expect(controller.readActionError("line:first")).toBe("Deferred failure.");

		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					itemId: "runtime:second",
					origin: controller.readOrigin(null),
				}),
			),
		);
		expect(controller.readActionError("line:first")).toBeNull();
	});

	it("keeps pending actions visible and resolves outstanding exit settlement on reset", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));
		const deferred = Effect.runSync(Deferred.make<never, Error>());
		const outcome = Effect.runPromiseExit(
			controller.runPendingActionFx({
				key: "line:first",
				action: "start",
				failureMessage: "Start failed.",
				run: Deferred.await(deferred),
			}),
		);
		await Effect.runPromise(controller.closeFx());
		expect(controller.getSnapshot().state.phase).toBe("open");
		expect(
			Effect.runSync(
				controller.openTargetFx(
					runtimeTarget({
						tab: "info",
					}),
				),
			),
		).toBe(false);

		const failure = new Error("Visible failure.");
		Effect.runSync(Deferred.fail(deferred, failure));
		const commandExit = await outcome;
		expect(Exit.isFailure(commandExit)).toBe(true);
		if (Exit.isSuccess(commandExit)) throw new Error("Expected command failure.");
		expect(Cause.findErrorOption(commandExit.cause)).toEqual(Option.some(failure));
		expect(controller.readActionError("line:first")).toBe("Visible failure.");
		expect(controller.readPendingAction("line:first")).toBeNull();

		const exit = Effect.runPromise(controller.closeFx());
		expect(controller.getSnapshot().state.phase).toBe("exiting");
		Effect.runSync(controller.resetFx);
		await exit;
		expect(controller.getSnapshot()).toEqual({
			state: {
				phase: "closed",
			},
			pendingActions: new Map(),
			actionErrors: new Map(),
		});
	});

	it("records typed failures but preserves defects as causes and always cleans pending", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));

		const typedFailure = new ExpectedItemDetailFailure({
			message: "Typed failure.",
		});
		const typedExit = await Effect.runPromiseExit(
			controller.runPendingActionFx({
				key: "line:typed",
				action: "start",
				failureMessage: "Fallback failure.",
				run: Effect.fail(typedFailure),
			}),
		);
		expect(Exit.isFailure(typedExit)).toBe(true);
		if (Exit.isSuccess(typedExit)) throw new Error("Expected typed command failure.");
		expect(Cause.findErrorOption(typedExit.cause)).toEqual(Option.some(typedFailure));
		expect(controller.readActionError("line:typed")).toBe("Typed failure.");
		expect(controller.readPendingAction("line:typed")).toBeNull();

		const defect = new Error("Command defect.");
		const exit = await Effect.runPromiseExit(
			controller.runPendingActionFx({
				key: "line:defect",
				action: "start",
				failureMessage: "Must not be published.",
				run: Effect.die(defect),
			}),
		);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(Cause.hasDies(exit.cause)).toBe(true);
			expect(Cause.squash(exit.cause)).toBe(defect);
		}
		expect(controller.readActionError("line:defect")).toBeNull();
		expect(controller.readPendingAction("line:defect")).toBeNull();
	});

	it("cleans interruption and lets different keys settle independently", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));

		const interruptedFiber = Effect.runFork(
			controller.runPendingActionFx({
				key: "line:interrupted",
				action: "withdraw",
				failureMessage: "Must not be published.",
				run: Effect.never,
			}),
		);
		await vi.waitFor(() =>
			expect(controller.readPendingAction("line:interrupted")).toBe("withdraw"),
		);
		await Effect.runPromise(Fiber.interrupt(interruptedFiber));
		expect(controller.readPendingAction("line:interrupted")).toBeNull();
		expect(controller.readActionError("line:interrupted")).toBeNull();

		const first = Effect.runSync(Deferred.make<void>());
		const second = Effect.runSync(Deferred.make<void>());
		const firstOutcome = Effect.runPromise(
			controller.runPendingActionFx({
				key: "line:first",
				action: "autofill",
				failureMessage: "First failed.",
				run: Deferred.await(first),
			}),
		);
		const secondOutcome = Effect.runPromise(
			controller.runPendingActionFx({
				key: "line:second",
				action: "start",
				failureMessage: "Second failed.",
				run: Deferred.await(second),
			}),
		);
		expect(controller.readPendingAction("line:first")).toBe("autofill");
		expect(controller.readPendingAction("line:second")).toBe("start");

		Effect.runSync(Deferred.succeed(first, undefined));
		await firstOutcome;
		expect(controller.readPendingAction("line:first")).toBeNull();
		expect(controller.readPendingAction("line:second")).toBe("start");

		Effect.runSync(Deferred.succeed(second, undefined));
		await secondOutcome;
		expect(controller.readPendingAction("line:second")).toBeNull();
	});
});
