// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createItemDetailControllerFx } from "~/item-detail-frame/fx/createItemDetailControllerFx";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";

const runtimeTarget = ({
	itemId = "runtime:first",
	origin = null,
}: {
	readonly itemId?: string;
	readonly origin?: HTMLElement | null;
} = {}) =>
	({
		kind: "runtime",
		itemId,
		origin,
	}) satisfies ItemDetailTarget;

describe("Item Detail frame controller", () => {
	it("owns origin retention and generation-safe close settlement", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribeFn(listener);
		expect(
			Effect.runSync(
				controller.openTargetFx(
					runtimeTarget({
						origin,
					}),
				),
			),
		).toBe(true);
		const entering = controller.getSnapshotFn();
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		expect(controller.readOriginFn(document.createElement("button"))).toBe(origin);
		Effect.runSync(controller.completeEnterFx(entering.generation + 1));
		expect(controller.getSnapshotFn().phase).toBe("entering");
		Effect.runSync(controller.completeEnterFx(entering.generation));

		const close = Effect.runPromise(controller.closeFx());
		await Promise.resolve();
		expect(controller.getSnapshotFn().phase).toBe("exiting");
		Effect.runSync(controller.completeExitFx(entering.generation + 1));
		expect(controller.getSnapshotFn().phase).toBe("exiting");
		Effect.runSync(controller.completeExitFx(entering.generation));
		await close;
		expect(controller.getSnapshotFn()).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(4);
	});

	it("resolves an outstanding close when reset tears down the presentation owner", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshotFn();
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));
		const close = Effect.runPromise(controller.closeFx());
		await Promise.resolve();
		Effect.runSync(controller.resetFx);
		await close;
		expect(controller.getSnapshotFn()).toEqual({
			phase: "closed",
		});
	});

	it("lets an immediate close preempt a delayed Board-change exit", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshotFn();
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		const delayed = Effect.runPromise(
			controller.closeFx({
				restoreFocus: false,
				exitDelayMs: 360,
			}),
		);
		await Promise.resolve();
		expect(controller.getSnapshotFn()).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
			exitDelayMs: 360,
		});
		const immediate = Effect.runPromise(controller.closeFx());
		await Promise.resolve();
		expect(controller.getSnapshotFn()).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
			exitDelayMs: 0,
		});
		Effect.runSync(controller.completeExitFx(entering.generation));
		await Promise.all([
			delayed,
			immediate,
		]);
	});
});
