import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import {
	flushMicrotasks,
	item,
	mountController,
	pointer,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: motion", () => {
	it("keeps a held item and its release target at a stationary pointer after camera movement", async () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const initialX = mounted.actor.container.x;
		const initialY = mounted.actor.container.y;

		// This queued sample belongs to the old camera and must not overwrite the refresh.
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.container.position.set(-80, -40);
		Effect.runSync(
			mounted.controller.refreshPointerFx({
				pointerId: 1,
				x: 30,
				y: 20,
			}),
		);
		expect(mounted.actor.container.x).toBe(initialX + 80);
		expect(mounted.actor.container.y).toBe(initialY + 40);
		expect(mounted.dropTargetReads.at(-1)).toEqual({
			x: 110,
			y: 60,
		});
		const readsAfterRefresh = mounted.dropTargetReads.length;
		mounted.flushFrame();
		expect(mounted.dropTargetReads).toHaveLength(readsAfterRefresh);
		expect(mounted.actor.container.x).toBe(initialX + 80);

		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();
		expect(mounted.dropTargetReads.at(-1)).toEqual({
			x: 110,
			y: 60,
		});
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		Effect.runSync(mounted.controller.closeFx);
	});

	it("does not promote a press or refresh another pointer when the camera moves", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.container.position.set(-80, -40);
		Effect.runSync(
			mounted.controller.refreshPointerFx({
				pointerId: 1,
				x: 10,
				y: 20,
			}),
		);
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.dropTargetReads).toHaveLength(0);

		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const reads = mounted.dropTargetReads.length;
		Effect.runSync(
			mounted.controller.refreshPointerFx({
				pointerId: 2,
				x: 90,
				y: 20,
			}),
		);
		expect(mounted.dropTargetReads).toHaveLength(reads);
		Effect.runSync(mounted.controller.closeFx);
	});

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
