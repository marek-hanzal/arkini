import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import {
	flushMicrotasks,
	item,
	mountController,
	pointer,
} from "~test/ui/pixi/PixiMainSceneDragController.test/fixture";

describe("Pixi main-scene drag controller: motion", () => {
	it("allows click activation without taking transform ownership during canonical motion", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"handoff",
				],
			]),
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(13, 23));
		mounted.stage.emit("pointerup", pointer(13, 23));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledWith(item, "primary", expect.anything());
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.cancelAnimation).toHaveBeenCalledExactlyOnceWith(
			`activity-particles:${mounted.actor.instanceId}`,
		);
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.finishCursorGrab).not.toHaveBeenCalled();
		expect(mounted.magneticUpdates).toHaveLength(0);
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
	});

	it("supersedes canonical motion at drag threshold without jumping from the live pose", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"handoff",
				],
			]),
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.actor.container.x = 42;
		mounted.actor.container.y = 34;
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.beginInteractionHandoff).toHaveBeenCalledWith(item.id);
		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(42);
		expect(mounted.actor.container.y).toBe(34);
		expect(mounted.startCursorGrab).toHaveBeenCalledExactlyOnceWith(mounted.actor, {
			x: 30,
			y: 20,
		});

		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("does not reinterpret a failed motion handoff drag as a click", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});
		mounted.beginInteractionHandoff.mockReturnValueOnce(false);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		claims.set(item.id, "activation-only");
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
	});

	it.each([
		"spawn",
		"swap",
	] as const)("does not promote an exiting actor when %s completes between press and drag threshold", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});
		mounted.beginInteractionHandoff.mockReturnValueOnce(false);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		claims.delete(item.id);
		mounted.actors.delete(item.id);
		mounted.canonicalItems.delete(item.id);
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("leaves an active motion cue intact when its canonical actor disappears after press", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.canonicalItems.delete(item.id);
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.actors.get(item.id)).toBe(mounted.actor);
		expect(claims.get(item.id)).toBe("handoff");
		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
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
