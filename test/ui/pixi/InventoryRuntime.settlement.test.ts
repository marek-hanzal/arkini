// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { consumedFadeDurationMs } from "~/ui/pixi/animation/flashConsumedSourceFx";
import { feedbackDurationMs } from "~/ui/pixi/animation/runActivityParticlesFx";
import { Effect } from "effect";

import {
	flushMicrotasks,
	inventoryItem,
	inventoryTargetItem,
	mountScene,
	moveInventoryItem,
	pointer,
	publishItems,
	readTestInventoryLayout,
	inventorySceneProbe as sceneState,
	slotPointer,
} from "./InventoryRuntime.test/fixture";
import type { FakeContainer } from "./InventoryRuntime.test/fixture";

describe("Inventory runtime / drop settlement", () => {
	it("flashes the canonical receiver after an accepted Inventory stack", async () => {
		sceneState.items = [
			inventoryItem,
			inventoryTargetItem,
		];
		sceneState.deferredTweenDurations.add(consumedFadeDurationMs);
		sceneState.deferredTweenDurations.add(feedbackDurationMs);
		const onDrop = vi.fn(() =>
			Promise.resolve({
				kind: "stack",
				source: {
					current: {
						itemId: inventoryItem.id,
					},
					itemId: inventoryItem.id,
				},
				target: {
					itemId: inventoryTargetItem.id,
				},
			} as never),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		const receiver = sceneState.actors[1];
		if (receiver === undefined) throw new Error("Expected the Inventory stack receiver.");
		expect(receiver.activityParticles.container).toMatchObject({
			visible: true,
		});
		expect(receiver.activityParticles.particles[0]?.particle.alpha).toBeGreaterThan(0);
		expect(actor.container.alpha).toBeCloseTo(0.42);
		await Effect.runPromise(runtime.closeFx);
	});
	it("keeps awaitingCommand exclusive and settles only a rejected drop", async () => {
		let resolveDrop: ((result: never) => void) | undefined;
		const onDrop = vi.fn(
			() =>
				new Promise<never>((resolve) => {
					resolveDrop = resolve;
				}),
		);
		const { actor, onActivate, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;
		const actorContainer = actor.container as unknown as FakeContainer;
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.cursor).toBe("grab");
		expect(actor.container.x).not.toBe(initialX);
		Effect.runSync(runtime.cancelInteractionFx);
		expect(actor.container.x).not.toBe(initialX);
		actorContainer.emit("pointerdown", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		expect(onDrop).toHaveBeenCalledOnce();
		expect(onActivate).not.toHaveBeenCalled();

		if (resolveDrop === undefined) throw new Error("Drop Promise was not created.");
		resolveDrop({
			kind: "reject",
		} as never);
		await flushMicrotasks();

		expect(actor.container.x).toBe(initialX);
		await Effect.runPromise(runtime.closeFx);
	});
	it("holds the released actor through an early transition and reconciles it after acceptance", async () => {
		let resolveDrop: ((result: never) => void) | undefined;
		const onDrop = vi.fn(
			() =>
				new Promise<never>((resolve) => {
					resolveDrop = resolve;
				}),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;
		const releasedPointer = slotPointer(1);
		const offsetReleasedPointer = pointer(
			releasedPointer.global.x + 10,
			releasedPointer.global.y,
		);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", offsetReleasedPointer);
		stage.emit("pointerup", offsetReleasedPointer);
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		const releasedX = actor.container.x;
		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.dragging).toBe(true);
		expect(actor.container.x).toBe(releasedX);
		expect(actor.container.x).not.toBe(initialX + readTestInventoryLayout().surface.cellSize);

		if (resolveDrop === undefined) throw new Error("Drop Promise was not created.");
		resolveDrop({
			kind: "move",
		} as never);
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize);
		await Effect.runPromise(runtime.closeFx);
	});
	it("settles against the current snapshot when acceptance precedes its transition", async () => {
		const { actor, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX);

		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize);
		await Effect.runPromise(runtime.closeFx);
	});
	it("cancels one active gesture through the shared interaction owner", async () => {
		const { actor, onActivate, onDrop, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		expect(actor.container.x).not.toBe(initialX);

		Effect.runSync(runtime.cancelInteractionFx);

		expect(actor.container.x).toBe(initialX);
		expect(runtime.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
		stage.emit("pointerup", slotPointer(1));
		expect(onDrop).not.toHaveBeenCalled();
		expect(onActivate).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});
	it("settles a dragged actor at the latest physical size after a live resize", async () => {
		const { actor, runtime, stage } = await mountScene();
		const originalBaseSize = actor.size;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));

		if (sceneState.owner === null || sceneState.resize === null) {
			throw new Error("Inventory resize owner is missing.");
		}
		(
			sceneState.owner.app.screen as {
				width: number;
			}
		).width = 600;
		sceneState.resize();
		expect(actor.dragging).toBe(true);
		expect(actor.size).toBe(originalBaseSize);

		Effect.runSync(runtime.cancelInteractionFx);

		expect(actor.dragging).toBe(false);
		expect(actor.size * actor.container.scale.x).toBe(readTestInventoryLayout(600).actorSize);
		await Effect.runPromise(runtime.closeFx);
	});
});
