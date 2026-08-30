// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { readMainLayoutFn } from "~/ui/pixi/layout/fn/readMainLayoutFn";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

import {
	flushMicrotasks,
	inventoryItem,
	mountScene,
	publishItems,
	inventorySceneProbe as sceneState,
	slotPointer,
} from "./InventoryRuntime.test/fixture";
import type { FakeContainer } from "./InventoryRuntime.test/fixture";

describe("Inventory runtime / activation lifecycle", () => {
	it("uses the Board actor size and routes an ordinary click to Inventory activation", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const expectedBoardSize = readMainLayoutFn({
			boardHeight: 7,
			boardWidth: 11,
			height: 480,
			toolbarSize: 8,
			width: 800,
		}).board.cellSize;

		expect(actor.size).toBe(expectedBoardSize);
		expect(sceneState.roundRects).toBeGreaterThanOrEqual(3);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(onActivate).toHaveBeenCalledWith(
			inventoryItem,
			false,
			expect.any(HTMLCanvasElement),
		);
		expect(sceneState.drop).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});
	it("starts removal feedback on click and retains the removed actor until its fade completes", async () => {
		sceneState.deferFiniteTweens = true;
		const onActivate = vi.fn(() => new Promise<void>(() => undefined));
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(actor.container.cursor).toBe("grab");
		expect(actor.container.alpha).toBe(0);
		expect(actor.container.destroyed).toBe(false);

		publishItems([]);

		expect(actor.onPointerDown).toBeNull();
		expect(actorContainer.eventMode).toBe("none");
		expect(actor.container.destroyed).toBe(false);

		for (const complete of [
			...sceneState.pendingTweenCompletions,
		]) {
			complete();
		}
		expect(actor.container.destroyed).toBe(true);
		await Effect.runPromise(runtime.closeFx);
	});
	it("keeps a Space actor committed while its authoritative activation is pending", async () => {
		let resolveActivation: () => void = () => undefined;
		const activation = new Promise<void>((resolve) => {
			resolveActivation = resolve;
		});
		const onActivate = vi.fn(() => activation);
		sceneState.items = [
			{
				...inventoryItem,
				itemType: "space",
				primaryAction: {
					currentSpace: 0,
					kind: "activate-space",
				},
			},
		];
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(actor.container.alpha).toBe(1);
		expect(actor.container.destroyed).toBe(false);

		resolveActivation();
		await flushMicrotasks();
		await Effect.runPromise(runtime.closeFx);
	});
	it("reclaims the same physical actor when its item returns before exit completes", async () => {
		sceneState.deferFiniteTweens = true;
		const { actor, onActivate, runtime, stage } = await mountScene();

		publishItems([]);
		expect(actor.container.alpha).toBe(0);
		expect(actor.container.destroyed).toBe(false);

		publishItems([
			{
				...inventoryItem,
				quantity: 2,
				revision: "revision:water:return",
			},
		]);

		expect(sceneState.actors).toEqual([
			actor,
		]);
		expect(actor.item.quantity).toBe(2);
		expect(actor.container.alpha).toBe(1);
		expect(actor.container.destroyed).toBe(false);
		expect(actor.container.eventMode).toBe("static");
		expect(actor.container.cursor).toBe("grab");
		expect(actor.onPointerDown).not.toBeNull();

		for (const complete of [
			...sceneState.pendingTweenCompletions,
		]) {
			complete();
		}
		expect(actor.container.destroyed).toBe(false);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		expect(onActivate).toHaveBeenCalledOnce();
		await Effect.runPromise(runtime.closeFx);
	});
	it("coalesces repeated clicks while the same Inventory activation is still pending", async () => {
		const onActivate = vi.fn(() => new Promise<void>(() => undefined));
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(actor.container.alpha).toBe(0);
		await Effect.runPromise(runtime.closeFx);
	});
	it("restores a left-click fade after a newer right-click detail activation settles first", async () => {
		let resolveOrdinary: () => void = () => undefined;
		const ordinary = new Promise<void>((resolve) => {
			resolveOrdinary = resolve;
		});
		const onActivate = vi.fn((_item: TileActorItem, openDetail: boolean) =>
			openDetail ? Promise.resolve() : ordinary,
		);
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0, 2));
		stage.emit("pointerup", slotPointer(0, 2));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledTimes(2);
		expect(actor.container.alpha).toBe(0);

		resolveOrdinary();
		await flushMicrotasks();
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});
});
