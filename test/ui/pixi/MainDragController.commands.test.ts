import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import {
	createItem,
	item,
	mountController,
	pointer,
	releaseOrdinaryDrag,
	setOrdinaryInventoryTarget,
} from "~test/ui/pixi/MainDragController.test/fixture";

describe("main drag controller: commands", () => {
	it("submits on pointer release and retains the exact pending actor until resolution", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		releaseOrdinaryDrag(mounted);

		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("rebases a held stack to its latest canonical revision before an Inventory release", () => {
		const inventory = {
			...createItem("runtime:inventory", 1),
			itemType: "inventory",
		} as TileActorItem;
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		const canonicalStack = {
			...item,
			quantity: 2,
			revision: "revision:log:incoming-stacked",
		} satisfies TileActorItem;
		mounted.canonicalItems.set(item.id, canonicalStack);
		mounted.setItem({
			...canonicalStack,
			// The incoming payload remains visually hidden until physical contact.
			quantity: 1,
		});
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: item.id,
				sourceLocation: item.location,
				sourceRevision: canonicalStack.revision,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) =>
					animation.actor === mounted.actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0,
			),
		).toBe(true);
	});
});
