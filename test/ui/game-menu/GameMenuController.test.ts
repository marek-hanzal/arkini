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

		void RendererRuntime.runSync(controller.closeFx);
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

		const first = RendererRuntime.runSync(controller.closeFx);
		const second = RendererRuntime.runSync(controller.closeFx);
		let completed = false;
		void first.then(() => {
			completed = true;
		});

		expect(second).toBe(first);
		expect(controller.getSnapshot().phase).toBe("exiting");
		await Promise.resolve();
		expect(completed).toBe(false);

		RendererRuntime.runSync(controller.completeExitFx);
		await first;
		expect(completed).toBe(true);
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			activeAction: null,
		});
	});

	it("resolves an outstanding exit and restores the initial snapshot on reset", async () => {
		const controller = RendererRuntime.runSync(createGameMenuControllerFx());
		RendererRuntime.runSync(controller.openFx);
		RendererRuntime.runSync(controller.completeEnterFx);
		const completion = RendererRuntime.runSync(controller.closeFx);

		RendererRuntime.runSync(controller.resetFx);

		await expect(completion).resolves.toBeUndefined();
		expect(controller.getSnapshot()).toEqual({
			phase: "closed",
			activeAction: null,
		});
	});
});
