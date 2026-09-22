import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import {
	flushMicrotasks,
	mountController,
	pointer,
	releaseOrdinaryDrag,
	samplePoseAnimation,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: recovery", () => {
	it("freezes the command target and admits it before a later close", async () => {
		const first = mountController();
		const releaseTarget = {
			kind: "unsupported" as const,
		};
		first.setCommandTarget(releaseTarget);
		releaseOrdinaryDrag(first);
		first.setCommandTarget({
			kind: "unsupported",
		});
		await flushMicrotasks();

		expect(first.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				target: releaseTarget,
			}),
		);
		expect(first.onSettledDrop).toHaveBeenCalledOnce();
		expect(first.actor.dragging).toBe(false);
		expect(first.actor.container.zIndex).toBe(0);

		const second = mountController();
		releaseOrdinaryDrag(second);
		Effect.runSync(second.controller.closeFx);
		Effect.runSync(second.dropSubmission.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
		expect(second.onSettledDrop).not.toHaveBeenCalled();
	});

	it("settles a rejected release from its exact pose", async () => {
		const mounted = mountController();
		const canonicalLayer = new Container();
		vi.spyOn(canonicalLayer, "addChild");
		mounted.setActorPose({
			layer: canonicalLayer,
			size: 80,
			x: 10,
			y: 20,
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.flushFrame();

		mounted.onDrop.mockResolvedValueOnce({
			kind: "reject",
		} as never);
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();
		expect(mounted.onRejectedDrop).toHaveBeenCalledOnce();

		const settleAnimation = mounted.animations.at(-1);
		if (settleAnimation === undefined) throw new Error("Expected a settle animation.");
		expect(settleAnimation).toMatchObject({
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
		});
		expect(settleAnimation.durationMs).toBeLessThan(280);
		expect(mounted.transientActorLayer.addChild).toHaveBeenLastCalledWith(
			mounted.actor.container,
		);
		expect(canonicalLayer.addChild).not.toHaveBeenCalled();
		samplePoseAnimation(settleAnimation, 1);
		settleAnimation.onCompleteFn?.();
		expect(mounted.onSettledDrop).toHaveBeenCalledOnce();
		expect(canonicalLayer.addChild).toHaveBeenCalledOnce();
		expect(canonicalLayer.addChild).toHaveBeenCalledWith(mounted.actor.container);
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.actor.container.zIndex).toBe(0);
		expect(mounted.actor.container.cursor).toBe("grab");
	});

	it("retargets a running settle from its live frame without a resize or completion snap", async () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.onDrop.mockResolvedValueOnce({
			kind: "reject",
		} as never);
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		const settleAnimation = mounted.animations.at(-1);
		if (settleAnimation === undefined) throw new Error("Expected a settle animation.");
		const beforeResize = samplePoseAnimation(settleAnimation, 0.4);
		expect(beforeResize).toEqual({
			scale: 1,
			x: 31,
			y: 20,
		});

		mounted.setActorPose({
			layer: mounted.transientActorLayer,
			size: 120,
			x: 200,
			y: 100,
		});
		expect(samplePoseAnimation(settleAnimation, 0.4)).toEqual(beforeResize);
		const afterResize = samplePoseAnimation(settleAnimation, 0.7);
		expect(afterResize.scale).toBeCloseTo(1.25);
		expect(afterResize.x).toBeCloseTo(115.5);
		expect(afterResize.y).toBeCloseTo(60);
		// The last target arrives after the penultimate frame; there is no interpolation frame left.
		mounted.setActorPose({
			layer: mounted.transientActorLayer,
			size: 160,
			x: 240,
			y: 120,
		});
		const destination = samplePoseAnimation(settleAnimation, 1);
		expect(destination).toEqual({
			scale: 2,
			x: 240,
			y: 120,
		});
		settleAnimation.onCompleteFn?.();
		expect(mounted.actor.container).toMatchObject({
			x: destination.x,
			y: destination.y,
		});
		expect(mounted.actor.container.scale.x).toBe(destination.scale);
	});

	it("reports an accepted replay failure without misclassifying it as command failure", async () => {
		const mounted = mountController();
		const failure = new Error("replay failed");
		mounted.onSettledDrop.mockImplementationOnce(() => {
			throw failure;
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		expect(mounted.reportCriticalFailureFn).toHaveBeenCalledWith("game-presentation", failure);
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});
});
