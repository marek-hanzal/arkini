import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { runTileDropAtom } from "~/tile-interaction/atom/runTileDropAtom";
import {
	createItem,
	flushMicrotasks,
	item,
	keyboard,
	mountController,
	pointer,
	setOrdinaryInventoryTarget,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: shortcuts", () => {
	it("sends a held item to the physical Inventory with i and retains it through travel and fade", async () => {
		const inventory = {
			...createItem("runtime:inventory", 2),
			itemType: "inventory",
		} as TileActorItem;
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		const inventoryActor = mounted.actors.get(inventory.id);
		if (inventoryActor === undefined) throw new Error("Expected the Inventory actor.");
		mounted.setItemActorPose(inventory.id, {
			layer: mounted.transientActorLayer,
			size: 80,
			x: 170,
			y: 20,
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("i");
		mounted.keyboardTarget.emit(keyEvent);

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(mounted.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				target: {
					kind: "slot",
					location: inventory.location,
					occupant: {
						itemId: inventory.id,
						revision: inventory.revision,
					},
				},
			}),
		);
		const travel = mounted.animations.find(
			(animation) =>
				animation.channel === "pose" &&
				animation.ownerKey === `inventory-shortcut-travel:${mounted.actor.instanceId}`,
		);
		expect(travel).toBeDefined();
		expect(
			mounted.animations.some((animation) => animation.channel === "lifecycle-opacity"),
		).toBe(false);

		resolveDrop({
			inventory: {
				itemId: inventory.id,
				location: inventory.location,
				revision: inventory.revision,
			},
			kind: "store-inventory",
			source: {
				canonicalItemId: item.itemId,
				current: null,
				itemId: item.id,
				previousLocation: item.location,
				previousQuantity: item.quantity,
				previousRevision: item.revision,
			},
		});
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(mounted.targetRedirects).toEqual([
			{
				sourceActorId: item.id,
				targetActorId: inventory.id,
				targetLocation: inventory.location,
			},
		]);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);

		travel?.onComplete?.();
		const fade = mounted.animations.find(
			(animation) =>
				animation.actor === mounted.actor && animation.channel === "lifecycle-opacity",
		);
		expect(fade).toEqual(
			expect.objectContaining({
				durationMs: 260,
				toAlpha: 0,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) =>
					animation.actor === inventoryActor &&
					animation.channel === "activity-particles",
			),
		).toBe(true);
		fade?.onComplete?.();

		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set(),
		);
		expect(mounted.actor.dragging).toBe(false);
		fade?.onCancel?.();
		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(mounted.targetRedirects).toHaveLength(1);
	});

	it("consumes i and leaves an active drag untouched when Inventory storage is unavailable", () => {
		const mounted = mountController();

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("i");
		mounted.keyboardTarget.emit(keyEvent);

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(true);

		mounted.stage.emit("pointerup", pointer(30, 20));
		expect(mounted.onDrop).toHaveBeenCalledOnce();
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
