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
} from "./InventoryRuntime.test/fixture";
import type { FakeContainer } from "./InventoryRuntime.test/fixture";

describe("Inventory runtime / drag authority", () => {
	it("drags only between Inventory slots and commits the release through the engine bridge", async () => {
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
