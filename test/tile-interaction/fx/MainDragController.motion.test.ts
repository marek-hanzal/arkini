import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import {
	flushMicrotasks,
	item,
	mountController,
	pointer,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: motion", () => {
	it.each([
		"cue",
		"pose",
	] as const)(
		"blocks clicks and drags while %s motion owns the item, then admits a new gesture after landing",
		async (kind) => {
			const claims = new Map<string, "blocked">();
			if (kind === "cue") claims.set(item.id, "blocked");
			const mounted = mountController({
				interactionClaimByActorId: claims,
			});
			mounted.isPoseActive.mockReturnValue(kind === "pose");

			mounted.actorEvents.emit("pointerdown", pointer(10, 20));
			mounted.stage.emit("pointerup", pointer(10, 20));
			mounted.actorEvents.emit("pointerdown", pointer(10, 20));
			mounted.stage.emit("globalpointermove", pointer(30, 20));
			mounted.stage.emit("pointerup", pointer(30, 20));
			await flushMicrotasks();
			expect(mounted.onActivate).not.toHaveBeenCalled();
			expect(mounted.onDrop).not.toHaveBeenCalled();
			expect(mounted.startCursorGrab).not.toHaveBeenCalled();
			expect(mounted.cancelAnimation).not.toHaveBeenCalled();

			claims.clear();
			mounted.isPoseActive.mockReturnValue(false);
			mounted.actorEvents.emit("pointerdown", pointer(10, 20));
			mounted.stage.emit("pointerup", pointer(10, 20));
			await flushMicrotasks();
			expect(mounted.onActivate).toHaveBeenCalledOnce();
		},
	);

	it.each([
		false,
		true,
	])(
		"discards a pressed gesture if canonical motion starts before release (drag: %s)",
		async (drag) => {
			const mounted = mountController();
			mounted.actorEvents.emit("pointerdown", pointer(10, 20));
			mounted.isPoseActive.mockReturnValue(true);
			mounted.stage.emit("pointerup", pointer(drag ? 30 : 10, 20));
			await flushMicrotasks();
			expect(mounted.onActivate).not.toHaveBeenCalled();
			expect(mounted.onDrop).not.toHaveBeenCalled();
			expect(mounted.startCursorGrab).not.toHaveBeenCalled();
			expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		},
	);

	it("does not submit a manual drop onto a receiver still in flight", async () => {
		const receiver = {
			...item,
			id: "runtime:flying-receiver",
		};
		const claims = new Map<string, "blocked">([
			[
				receiver.id,
				"blocked",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
			targetItems: [
				receiver,
			],
		});
		mounted.setOccupant(receiver);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(false);
	});

	it("activates the latest projected item and immediately admits another click", async () => {
		const mounted = mountController();
		let resolveFirstActivation: (() => void) | undefined;
		mounted.onActivate.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveFirstActivation = resolve;
				}),
		);
		const completedInstantRun = {
			...item,
			revision: "revision:log:instant-complete",
			running: false,
		} satisfies TileActorItem;

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		mounted.setItem(completedInstantRun);
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledWith(
			completedInstantRun,
			"primary",
			expect.anything(),
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledTimes(2);
		resolveFirstActivation?.();
	});
});
