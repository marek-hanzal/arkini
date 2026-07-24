import { describe, expect, it, vi } from "vitest";

import { createGameMenuController } from "~/ui/game-menu/createGameMenuController";

describe("GameMenuController", () => {
	it("guards same-tick lifecycle and route intents from one synchronous snapshot", () => {
		const controller = createGameMenuController();
		const listener = vi.fn();
		controller.subscribe(listener);

		controller.open();
		controller.open();
		expect(controller.getSnapshot()).toEqual({
			phase: "entering",
			routePending: false,
		});
		expect(listener).toHaveBeenCalledOnce();

		controller.completeEnter();
		expect(controller.beginRouteRequest()).toBe(true);
		expect(controller.beginRouteRequest()).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			routePending: true,
		});

		void controller.close();
		expect(controller.getSnapshot().phase).toBe("open");
		controller.completeRouteRequest();
		expect(controller.getSnapshot().routePending).toBe(false);
	});

	it("shares one exit completion and resolves it only after the current animation exits", async () => {
		const controller = createGameMenuController();
		controller.open();
		controller.completeEnter();

		const first = controller.close();
		const second = controller.close();
		let completed = false;
		void first.then(() => {
			completed = true;
		});

		expect(second).toBe(first);
		expect(controller.getSnapshot().phase).toBe("exiting");
		await Promise.resolve();
		expect(completed).toBe(false);

		controller.completeExit();
		await first;
		expect(completed).toBe(true);
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			routePending: false,
		});
	});

	it("resolves an outstanding exit and restores the initial snapshot on reset", async () => {
		const controller = createGameMenuController();
		controller.open();
		controller.completeEnter();
		const completion = controller.close();

		controller.reset();

		await expect(completion).resolves.toBeUndefined();
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			routePending: false,
		});
	});
});
