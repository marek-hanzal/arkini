// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { createInventoryController } from "~/ui/inventory/createInventoryController";

describe("InventoryController", () => {
	it("guards same-tick lifecycle intents from one synchronous snapshot", () => {
		const controller = createInventoryController();
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribe(listener);

		expect(controller.close()).toBe(false);
		expect(
			controller.open({
				origin,
			}),
		).toBe(true);
		expect(controller.open()).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			origin,
		});
		expect(listener).toHaveBeenCalledOnce();

		expect(controller.close()).toBe(true);
		expect(controller.close()).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("owns deferred focus restoration and consumes it at most once", () => {
		const controller = createInventoryController();
		const origin = document.createElement("button");

		controller.open({
			origin,
		});
		controller.close();

		expect(controller.takeRestoreOrigin()).toBe(origin);
		expect(controller.takeRestoreOrigin()).toBeNull();

		controller.open({
			origin,
		});
		controller.close({
			restoreFocus: false,
		});
		expect(controller.takeRestoreOrigin()).toBeNull();
	});

	it("cancels stale focus restoration when Inventory reopens before consumption", () => {
		const controller = createInventoryController();
		const origin = document.createElement("button");

		controller.open({
			origin,
		});
		controller.close();
		controller.open();

		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			origin: null,
		});
		expect(controller.takeRestoreOrigin()).toBeNull();
	});

	it("restores the initial owner state on reset", () => {
		const controller = createInventoryController();
		const origin = document.createElement("button");

		controller.open({
			origin,
		});
		controller.close();
		controller.reset();

		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
		});
		expect(controller.takeRestoreOrigin()).toBeNull();
	});
});
