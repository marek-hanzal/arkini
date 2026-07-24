// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";
import { createItemDetailController } from "~/ui/item-detail/createItemDetailController";

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
	it("owns same-tick lifecycle, origin retention, and one generation-safe exit promise", async () => {
		const controller = createItemDetailController();
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribe(listener);

		expect(
			controller.openTarget(
				runtimeTarget({
					origin,
				}),
			),
		).toBe(true);
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		expect(controller.readOrigin(document.createElement("button"))).toBe(origin);

		controller.completeEnter(entering.generation + 1);
		expect(controller.getSnapshot().state.phase).toBe("entering");
		controller.completeEnter(entering.generation);
		expect(controller.getSnapshot().state.phase).toBe("open");

		controller.openTarget(
			runtimeTarget({
				tab: "info",
				origin: controller.readOrigin(null),
			}),
		);
		expect(controller.getSnapshot().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				tab: "info",
				origin,
			},
		});

		const firstClose = controller.close();
		const secondClose = controller.close({
			restoreFocus: false,
		});
		expect(secondClose).toBe(firstClose);
		expect(controller.getSnapshot().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
		});

		let settled = false;
		void firstClose.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		controller.completeExit(entering.generation + 1);
		expect(controller.getSnapshot().state.phase).toBe("exiting");
		controller.completeExit(entering.generation);
		await firstClose;
		expect(settled).toBe(true);
		expect(controller.getSnapshot().state).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(6);
	});

	it("retains command ownership across tab remounts and scopes failures to one target", async () => {
		const controller = createItemDetailController();
		controller.openTarget(runtimeTarget());
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		controller.completeEnter(entering.generation);
		let rejectRun: ((cause: Error) => void) | undefined;
		const deferred = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const run = vi.fn(() => deferred);

		const outcome = controller.runPendingAction({
			key: "line:first",
			action: "default",
			failureMessage: "Default failed.",
			run,
		});
		void controller.runPendingAction({
			key: "line:first",
			action: "start",
			failureMessage: "Start failed.",
			run,
		});
		expect(run).toHaveBeenCalledOnce();
		expect(controller.readPendingAction("line:first")).toBe("default");

		controller.openTarget(
			runtimeTarget({
				tab: "info",
				origin: controller.readOrigin(null),
			}),
		);
		expect(controller.readPendingAction("line:first")).toBe("default");
		rejectRun?.(new Error("Deferred failure."));
		await outcome;
		expect(controller.readPendingAction("line:first")).toBeNull();
		expect(controller.readActionError("line:first")).toBe("Deferred failure.");

		controller.openTarget(
			runtimeTarget({
				itemId: "runtime:second",
				origin: controller.readOrigin(null),
			}),
		);
		expect(controller.readActionError("line:first")).toBeNull();
	});

	it("drops late failures after exit and resolves outstanding settlement on reset", async () => {
		const controller = createItemDetailController();
		controller.openTarget(runtimeTarget());
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		controller.completeEnter(entering.generation);
		let rejectRun: ((cause: Error) => void) | undefined;
		const deferred = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const outcome = controller.runPendingAction({
			key: "line:first",
			action: "start",
			failureMessage: "Start failed.",
			run: () => deferred,
		});
		const exit = controller.close();

		rejectRun?.(new Error("Late failure."));
		await outcome;
		expect(controller.readActionError("line:first")).toBeNull();
		expect(controller.readPendingAction("line:first")).toBeNull();

		controller.reset();
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
