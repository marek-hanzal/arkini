import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import {
	createItem,
	flushMicrotasks,
	mountController,
	pointer,
	releaseOrdinaryDrag,
	setOrdinaryInventoryTarget,
	samplePoseAnimation,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: recovery", () => {
	it("restores and settles the optimistic Inventory actor after a command error", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		const cause = new Error("drop failed");
		mounted.onDrop.mockRejectedValueOnce(cause);

		releaseOrdinaryDrag(mounted);
		await flushMicrotasks();

		expect(mounted.reportCriticalFailureFn).toHaveBeenCalledWith("game-presentation", cause);
		expect(mounted.actor.lifecycleTargetAlpha).toBe(1);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 1,
			}),
		);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
				toScale: 1,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) => animation.actor === mounted.actor && animation.channel === "pose",
			),
		).toBe(true);
	});

	it("ignores a pending Inventory result after the scene owners close", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController();
		setOrdinaryInventoryTarget(mounted, inventory);
		let resolveDrop!: (result: DropItemResult) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<DropItemResult>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		releaseOrdinaryDrag(mounted);
		await Promise.resolve();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		Effect.runSync(mounted.controller.closeFx);
		Effect.runSync(mounted.dropSubmission.closeFx);
		resolveDrop({
			kind: "reject",
		} as DropItemResult);
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});

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
		expect(first.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(first.actor.dragging).toBe(false);
		expect(first.actor.container.zIndex).toBe(0);

		const second = mountController();
		releaseOrdinaryDrag(second);
		Effect.runSync(second.controller.closeFx);
		Effect.runSync(second.dropSubmission.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
		expect(second.onAcceptedDrop).not.toHaveBeenCalled();
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
		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
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
		const destination = samplePoseAnimation(settleAnimation, 1);
		expect(destination).toEqual({
			scale: 1.5,
			x: 200,
			y: 100,
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
		mounted.onAcceptedDrop.mockImplementationOnce(() => {
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
