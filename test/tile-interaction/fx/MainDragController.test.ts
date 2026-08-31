import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import {
	item,
	mountController,
	pointer,
	previewTestState as previewState,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: pointer", () => {
	it("coalesces a raw pointer burst into one latest-sample drag update", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(20, 20));
		mounted.stage.emit("globalpointermove", pointer(35, 20));
		mounted.stage.emit("globalpointermove", pointer(70, 20));

		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.magneticUpdates).toEqual([]);
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(70);
		expect(mounted.magneticUpdates).toHaveLength(1);
	});

	it("latches a raw threshold crossing through an exact release below the threshold", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(70, 20));
		mounted.stage.emit("globalpointermove", pointer(12, 20));
		mounted.stage.emit("pointerup", pointer(12, 20));

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("cleans up a scheduled drag failure before reporting it", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.actor.dragging).toBe(true);

		mounted.reportCriticalFailureFn.mockImplementationOnce(() => {
			expect(mounted.actor.dragging).toBe(false);
			expect(mounted.finishCursorGrab).toHaveBeenCalledOnce();
		});
		const failure = new Error("target facts failed");
		mounted.setTargetFactsFailure(failure);
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();

		expect(mounted.reportCriticalFailureFn).toHaveBeenCalledExactlyOnceWith(
			"game-presentation",
			failure,
		);
	});

	it("refreshes a stable target preview when exact source facts change", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(previewState.reads).toBe(1);

		const nextItem = {
			...item,
			revision: "revision:log:updated",
		} satisfies TileActorItem;
		mounted.canonicalItems.set(item.id, nextItem);
		mounted.setItem(nextItem);
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();

		expect(previewState.reads).toBe(2);
	});

	it("cancels a held drag when its canonical source disappears", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.actor.dragging).toBe(true);

		mounted.canonicalItems.delete(item.id);
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("flushes the exact release coordinates before submitting and cancels the stale frame", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("globalpointermove", pointer(55, 20));

		mounted.stage.emit("pointerup", pointer(90, 35));

		expect(mounted.actor.container).toMatchObject({
			x: 90,
			y: 35,
		});
		expect(mounted.dropTargetReads.at(-1)).toEqual({
			x: 90,
			y: 35,
		});
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		const updateCount = mounted.magneticUpdates.length;
		mounted.flushFrame();
		expect(mounted.magneticUpdates).toHaveLength(updateCount);
	});

	it.each([
		"pointer-cancel",
		"detach",
		"block",
		"close",
	] as const)("cancels stale scheduled pointer work on %s", (action) => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(70, 20));

		switch (action) {
			case "pointer-cancel":
				mounted.stage.emit("pointercancel", pointer(70, 20));
				break;
			case "detach":
				Effect.runSync(mounted.controller.detachActorFx(mounted.actor));
				break;
			case "block":
				Effect.runSync(mounted.controller.setInteractionBlockedFx(true));
				break;
			case "close":
				Effect.runSync(mounted.controller.closeFx);
				break;
		}
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.magneticUpdates).toEqual([]);
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("restores interaction state when a presentation owner hands an actor back", () => {
		const mounted = mountController();

		Effect.runSync(mounted.controller.detachActorFx(mounted.actor));
		mounted.actor.container.eventMode = "none";
		mounted.actor.container.cursor = "default";
		Effect.runSync(mounted.controller.attachActorFx(mounted.actor));

		expect(mounted.actor.container.eventMode).toBe("static");
		expect(mounted.actor.container.cursor).toBe("grab");
		expect(mounted.actor.onPointerDownFn).not.toBeNull();
	});

	it("acknowledges activation synchronously before async command admission", () => {
		const mounted = mountController();
		mounted.onActivate.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.actor.activityParticles.feedbackPhase).toBe("burst");
		expect(mounted.presentationWrites).toContainEqual({
			actor: mounted.actor,
			channel: "activity-particles",
			reset: true,
			visible: true,
		});
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${mounted.actor.instanceId}`,
			}),
		);
		const burst = mounted.animations.find(
			(animation) =>
				animation.actor === mounted.actor && animation.channel === "activity-particles",
		);
		if (burst?.channel === "activity-particles") burst.renderFn(0.5);
		const tint = mounted.actor.activityParticles.particles[0]?.particle.tint ?? 0;
		const red = (tint >> 16) & 0xff;
		const green = (tint >> 8) & 0xff;
		const blue = tint & 0xff;
		expect(green).toBeGreaterThan(blue);
		expect(blue).toBeGreaterThan(red);
	});
});
