import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { runTileDropAtom } from "~/tile-interaction/atom/runTileDropAtom";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createDragActor } from "~test/tile-interaction/fx/MainDragController.test/actors";
import {
	createItem,
	FakeEmitter,
	flushMicrotasks,
	item,
	mountController,
	pointer,
	releaseOrdinaryDrag,
	setOrdinaryInventoryTarget,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: ownership", () => {
	it("releases the board gesture while an Inventory drop is still pending", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const secondItem = createItem("runtime:second-log", 2);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		releaseOrdinaryDrag(mounted);
		await flushMicrotasks();

		const pendingSourcePointer = pointer(10, 20);
		mounted.actorEvents.emit("pointerdown", pendingSourcePointer);
		expect(pendingSourcePointer.stopPropagation).not.toHaveBeenCalled();

		const secondActor = createDragActor(secondItem);
		secondActor.container.position.set(170, 20);
		const secondEvents = new FakeEmitter(secondActor.container);
		mounted.actors.set(secondItem.id, secondActor);
		mounted.canonicalItems.set(secondItem.id, secondItem);
		Effect.runSync(mounted.controller.attachActorFx(secondActor));

		const secondPointer = {
			...pointer(170, 20),
			pointerId: 2,
		};
		secondEvents.emit("pointerdown", secondPointer);
		expect(secondPointer.stopPropagation).toHaveBeenCalledOnce();
		mounted.stage.emit("globalpointermove", {
			...pointer(190, 20),
			pointerId: 2,
		});
		mounted.flushFrame();
		expect(secondActor.dragging).toBe(true);
		mounted.stage.emit("pointerup", {
			...pointer(190, 20),
			pointerId: 2,
		});
		await flushMicrotasks();

		expect(mounted.onDrop).toHaveBeenCalledTimes(2);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("does not let a stale drop callback touch a replacement actor instance", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		releaseOrdinaryDrag(mounted);
		const replacement = {
			...mounted.actor,
			dragging: true,
			instanceId: "test:replacement",
		} satisfies PixiTileActor;
		mounted.actors.set(item.id, replacement);
		resolveDrop({
			kind: "reject",
		} as runTileDropAtom.Result);
		await flushMicrotasks();

		expect(replacement.dragging).toBe(true);
		expect(mounted.animations.some((animation) => animation.actor === replacement)).toBe(false);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});
});
