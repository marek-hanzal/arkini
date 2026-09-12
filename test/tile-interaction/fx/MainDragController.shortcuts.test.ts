import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
	flushMicrotasks,
	item,
	keyboard,
	mountController,
	pointer,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: shortcuts", () => {
	it("stores a held item with i through the engine without an opener or a synthetic drop", async () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("i");
		mounted.keyboardTarget.emit(keyEvent);
		await flushMicrotasks();
		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.storeInventory).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: item.id,
				sourceRevision: item.revision,
				sourceLocation: item.location,
			}),
		);
		expect(mounted.targetRedirects).toEqual([]);
		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set(),
		);
	});
	it("restores the held actor when direct Inventory storage is rejected", async () => {
		const mounted = mountController();
		mounted.storeInventory.mockReturnValueOnce({
			kind: "reject",
			itemId: item.id,
			reason: "blocked",
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		mounted.keyboardTarget.emit(keyboard("i"));
		await flushMicrotasks();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(false);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).hiddenActorIds).toEqual(
			new Set(),
		);
	});

	it("removes the held item through the Cheat command with d when this Game enabled cheats", async () => {
		const mounted = mountController({
			cheatsEnabled: true,
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("d");
		mounted.keyboardTarget.emit(keyEvent);
		await flushMicrotasks();

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.removeDraggedItem).toHaveBeenCalledWith({
			itemId: item.id,
			revision: item.revision,
		});
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(false);
	});
});
