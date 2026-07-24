import { describe, expect, it, vi } from "vitest";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createGameMenuControllerFx } from "~/ui/game-menu/createGameMenuControllerFx";

describe("GameMenuController", () => {
	it("guards same-tick lifecycle and action intents from one synchronous snapshot", () => {
		const controller = RendererRuntime.runSync(createGameMenuControllerFx());
		const listener = vi.fn();
		controller.subscribe(listener);

		RendererRuntime.runSync(controller.openFx);
		RendererRuntime.runSync(controller.openFx);
		expect(controller.getSnapshot()).toEqual({
			phase: "entering",
			activeAction: null,
		});
		expect(listener).toHaveBeenCalledOnce();

		RendererRuntime.runSync(controller.completeEnterFx);
		expect(RendererRuntime.runSync(controller.beginActionFx("settings"))).toBe(true);
		expect(RendererRuntime.runSync(controller.beginActionFx("cheats"))).toBe(false);
		expect(controller.getSnapshot()).toEqual({
			phase: "open",
			activeAction: "settings",
		});

		RendererRuntime.runSync(controller.closeFx());
		expect(controller.getSnapshot().phase).toBe("open");
		RendererRuntime.runSync(controller.toggleFx);
		expect(controller.getSnapshot().phase).toBe("open");
		RendererRuntime.runSync(controller.completeActionFx("cheats"));
		expect(controller.getSnapshot().activeAction).toBe("settings");
		RendererRuntime.runSync(controller.completeActionFx("settings"));
		expect(controller.getSnapshot().activeAction).toBeNull();
	});

	it("shares one exit completion and resolves it only after the current animation exits", async () => {
		const controller = RendererRuntime.runSync(createGameMenuControllerFx());
		RendererRuntime.runSync(controller.openFx);
		RendererRuntime.runSync(controller.completeEnterFx);

		const first = RendererRuntime.runPromise(controller.closeFx());
		const second = RendererRuntime.runPromise(controller.closeFx());
		let firstCompleted = false;
		let secondCompleted = false;
		void first.then(() => {
			firstCompleted = true;
		});
		void second.then(() => {
			secondCompleted = true;
		});

		expect(controller.getSnapshot().phase).toBe("exiting");
		await Promise.resolve();
		expect(firstCompleted).toBe(false);
		expect(secondCompleted).toBe(false);

		RendererRuntime.runSync(controller.completeExitFx);
		await Promise.all([
			first,
			second,
		]);
		expect(firstCompleted).toBe(true);
		expect(secondCompleted).toBe(true);
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			activeAction: null,
		});
	});

	it("resolves an outstanding exit and restores the initial snapshot on reset", async () => {
		const controller = RendererRuntime.runSync(createGameMenuControllerFx());
		RendererRuntime.runSync(controller.openFx);
		RendererRuntime.runSync(controller.completeEnterFx);
		const completion = RendererRuntime.runPromise(controller.closeFx());

		RendererRuntime.runSync(controller.resetFx);

		await expect(completion).resolves.toBeUndefined();
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			activeAction: null,
		});
	});
});
