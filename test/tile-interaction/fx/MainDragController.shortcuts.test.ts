import { describe, expect, it } from "vitest";
import {
	flushMicrotasks,
	item,
	keyboard,
	mountController,
	pointer,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: shortcuts", () => {
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
