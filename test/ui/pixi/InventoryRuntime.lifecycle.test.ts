// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import {
	createGame,
	flushMicrotasks,
	mountScene,
	inventorySceneProbe as sceneState,
	slotPointer,
} from "./InventoryRuntime.test/fixture";
import type { FakeContainer } from "./InventoryRuntime.test/fixture";

describe("Inventory runtime / close and failures", () => {
	it("suppresses deferred activation but admits a released drop before close", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		Effect.runSync(runtime.closeFx);
		await flushMicrotasks();
		expect(onActivate).not.toHaveBeenCalled();

		const second = await mountScene();
		const latestActor = sceneState.actors.at(-1);
		if (latestActor === undefined) throw new Error("Second Inventory actor is missing.");
		const secondActorContainer = latestActor.container as unknown as FakeContainer;
		secondActorContainer.emit("pointerdown", slotPointer(0));
		second.stage.emit("globalpointermove", slotPointer(1));
		second.stage.emit("pointerup", slotPointer(1));
		Effect.runSync(second.runtime.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
	});
	it("closes normally exactly once", async () => {
		const { actor, runtime } = await mountScene();

		await Effect.runPromise(runtime.closeFx);
		await Effect.runPromise(runtime.closeFx);

		expect(sceneState.close).toHaveBeenCalledOnce();
		expect(sceneState.resize).toBeNull();
		expect(sceneState.transitionListener).toBeNull();
		expect((actor.container as unknown as FakeContainer).destroyed).toBe(true);
	});
	it("rolls back acquired owners and listeners when late initialization fails", async () => {
		const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");

		await expect(
			mountScene({
				game: createGame({
					subscribeError: new Error("subscription failed"),
				}),
			}),
		).rejects.toThrow("subscription failed");

		expect(sceneState.close).toHaveBeenCalledOnce();
		expect(sceneState.resize).toBeNull();
		expect(disconnect).toHaveBeenCalledOnce();
		expect(sceneState.actors).toHaveLength(1);
		expect((sceneState.actors[0]?.container as unknown as FakeContainer).destroyed).toBe(true);
	});
	it("isolates synchronous activation failures and releases exact actor ownership", async () => {
		const onActivate = vi.fn(() => {
			throw new Error("activation failed");
		});
		const { actor, game, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledTimes(2);
		expect(game.reportCriticalFailure).toHaveBeenCalledWith(
			"game-presentation",
			expect.any(Error),
		);
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});
	it("keeps expected Inventory activation rejections non-fatal", async () => {
		const expected = {
			_tag: "PlacementUnavailableError",
		};
		const onActivate = vi.fn(() => Promise.reject(expected));
		const { actor, game, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(game.reportCriticalFailure).not.toHaveBeenCalled();
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});
	it("isolates synchronous drop failures and settles the released actor", async () => {
		const onDrop = vi.fn(() => {
			throw new Error("drop failed");
		});
		const { actor, game, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.x).toBe(initialX);
		expect(game.reportCriticalFailure).toHaveBeenCalledWith(
			"game-presentation",
			expect.any(Error),
		);
		await Effect.runPromise(runtime.closeFx);
	});
});
