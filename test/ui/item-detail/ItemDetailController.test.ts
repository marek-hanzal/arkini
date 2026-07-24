// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";
import type { ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";

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
		let rejectRun: ((cause: Error) => void) | undefined;
		const deferred = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const run = vi.fn(() => deferred);

		const outcome = Effect.runPromise(
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
		expect(run).toHaveBeenCalledOnce();
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
		rejectRun?.(new Error("Deferred failure."));
		await outcome;
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
		let rejectRun: ((cause: Error) => void) | undefined;
		const deferred = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const outcome = Effect.runPromise(
			controller.runPendingActionFx({
				key: "line:first",
				action: "start",
				failureMessage: "Start failed.",
				run: () => deferred,
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

		rejectRun?.(new Error("Visible failure."));
		await outcome;
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
});
