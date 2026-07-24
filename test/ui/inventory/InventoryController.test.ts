// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createInventoryControllerFx } from "~/ui/inventory/createInventoryControllerFx";

describe("InventoryController", () => {
	it("guards same-tick lifecycle intents from one synchronous snapshot", () => {
		const controller = Effect.runSync(createInventoryControllerFx());
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribe(listener);

		expect(Effect.runSync(controller.closeFx())).toBe(false);
		expect(
			Effect.runSync(
				controller.openFx({
					origin,
				}),
			),
		).toBe(true);
		expect(Effect.runSync(controller.openFx())).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			origin,
		});
		expect(listener).toHaveBeenCalledOnce();

		expect(Effect.runSync(controller.closeFx())).toBe(true);
		expect(Effect.runSync(controller.closeFx())).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("owns deferred focus restoration and consumes it at most once", () => {
		const controller = Effect.runSync(createInventoryControllerFx());
		const origin = document.createElement("button");

		Effect.runSync(
			controller.openFx({
				origin,
			}),
		);
		Effect.runSync(controller.closeFx());

		expect(Effect.runSync(controller.takeRestoreOriginFx)).toBe(origin);
		expect(Effect.runSync(controller.takeRestoreOriginFx)).toBeNull();

		Effect.runSync(
			controller.openFx({
				origin,
			}),
		);
		Effect.runSync(
			controller.closeFx({
				restoreFocus: false,
			}),
		);
		expect(Effect.runSync(controller.takeRestoreOriginFx)).toBeNull();
	});

	it("cancels stale focus restoration when Inventory reopens before consumption", () => {
		const controller = Effect.runSync(createInventoryControllerFx());
		const origin = document.createElement("button");

		Effect.runSync(
			controller.openFx({
				origin,
			}),
		);
		Effect.runSync(controller.closeFx());
		Effect.runSync(controller.openFx());

		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			origin: null,
		});
		expect(Effect.runSync(controller.takeRestoreOriginFx)).toBeNull();
	});

	it("restores the initial owner state on reset", () => {
		const controller = Effect.runSync(createInventoryControllerFx());
		const origin = document.createElement("button");

		Effect.runSync(
			controller.openFx({
				origin,
			}),
		);
		Effect.runSync(controller.closeFx());
		Effect.runSync(controller.resetFx);

		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
		});
		expect(Effect.runSync(controller.takeRestoreOriginFx)).toBeNull();
	});
});
