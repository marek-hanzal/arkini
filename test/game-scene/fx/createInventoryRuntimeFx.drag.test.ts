// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import {
	flushMicrotasks,
	inventoryItem,
	inventoryTargetItem,
	mountScene,
	moveInventoryItem,
	publishItems,
	inventorySceneProbe as sceneState,
	slotPointer,
	pointer,
} from "./createInventoryRuntimeFx.test/fixture";
import type { FakeContainer } from "./createInventoryRuntimeFx.test/fixture";

describe("Inventory runtime / drag authority", () => {
	it("keeps the drag threshold in screen pixels and releases into world slots after zoom and pan", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		stage.scale.set(0.137);
		stage.position.set(27.3, -16.9);
		const pressed = slotPointer(0);
		(actor.container as unknown as FakeContainer).emit("pointerdown", pressed);
		stage.emit("globalpointermove", pointer(pressed.global.x + 5, pressed.global.y));
		expect(actor.dragging).toBe(false);
		stage.emit("globalpointermove", pointer(pressed.global.x + 6, pressed.global.y));
		expect(actor.dragging).toBe(true);
		expect(actor.container.x).toBeCloseTo(6 / 0.137);
		// Release owns the final slot even when there was no move event at that position.
		stage.emit("pointerup", slotPointer(2));
		expect(sceneState.drop).toHaveBeenCalledWith(
			expect.objectContaining({
				target: {
					kind: "slot",
					location: {
						scope: "inventory",
						position: {
							x: 2,
							y: 0,
						},
					},
					occupant: null,
				},
			}),
		);
		expect(onActivate).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("reset cancels a held item and restores the fitted Inventory camera without submitting a drop", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const initial = {
			x: stage.x,
			y: stage.y,
			scale: stage.scale.x,
		};
		stage.scale.set(0.6);
		stage.position.set(-100, 30);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		expect(actor.dragging).toBe(true);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "0",
				cancelable: true,
			}),
		);
		expect({
			x: stage.x,
			y: stage.y,
			scale: stage.scale.x,
		}).toEqual(initial);
		expect(actor.dragging).toBe(false);
		expect(actor.container.x).toBe(0);
		stage.emit("pointerup", slotPointer(1));
		expect(sceneState.drop).not.toHaveBeenCalled();
		expect(onActivate).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("drags only between Inventory slots and commits the release through the engine command boundary", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		expect(sceneState.drop).toHaveBeenCalledOnce();
		await Promise.resolve();
		await Promise.resolve();

		expect(onActivate).not.toHaveBeenCalled();
		expect(sceneState.preview).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: {
					kind: "slot",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					occupant: null,
				},
			}),
		);
		expect(sceneState.drop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				sourceLocation: inventoryItem.location,
				sourceRevision: inventoryItem.revision,
				target: {
					kind: "slot",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					occupant: null,
				},
			}),
		);
		expect(runtime.canvas.setPointerCapture).toHaveBeenCalledWith(1);
		expect(runtime.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(actor.container.x).toBe(initialX);
		await Effect.runPromise(runtime.closeFx);
	});
	it("rebases Inventory preview and release to the latest actor revision", async () => {
		const { actor, runtime, stage } = await mountScene();
		const latest = {
			...inventoryItem,
			quantity: 3,
			revision: "revision:water:latest",
		};

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([
			latest,
		]);

		expect(sceneState.preview).toHaveBeenLastCalledWith(
			expect.objectContaining({
				sourceItemId: latest.id,
				sourceLocation: latest.location,
				sourceRevision: latest.revision,
			}),
		);

		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: latest.id,
				sourceLocation: latest.location,
				sourceRevision: latest.revision,
			}),
		);
		await Effect.runPromise(runtime.closeFx);
	});
	it("cancels an Inventory release when the held actor moves", async () => {
		const { actor, runtime, stage } = await mountScene();

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([
			moveInventoryItem(1),
		]);
		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).not.toHaveBeenCalled();
		expect(actor.dragging).toBe(false);
		await Effect.runPromise(runtime.closeFx);
	});
	it("cancels an Inventory release when the held actor disappears", async () => {
		const { actor, runtime, stage } = await mountScene();

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([]);
		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).not.toHaveBeenCalled();
		expect(actor.dragging).toBe(false);
		await Effect.runPromise(runtime.closeFx);
	});
	it("submits the exact occupied Inventory slot so the engine can commit a swap", async () => {
		sceneState.items = [
			inventoryItem,
			inventoryTargetItem,
		];
		const onDrop = vi.fn(() =>
			Promise.resolve({
				kind: "swap",
			} as never),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		const occupiedTarget = {
			kind: "slot",
			location: inventoryTargetItem.location,
			occupant: {
				itemId: inventoryTargetItem.id,
				revision: inventoryTargetItem.revision,
			},
		};
		expect(sceneState.preview).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: occupiedTarget,
			}),
		);
		expect(onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: occupiedTarget,
			}),
		);
		await Effect.runPromise(runtime.closeFx);
	});
});
