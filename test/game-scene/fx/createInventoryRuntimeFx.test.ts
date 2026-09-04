// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { GameEngine } from "~/playable-game/type/GameEngine";

import {
	createGame,
	inventoryItem,
	mountScene,
	moveInventoryItem,
	readTestInventoryLayout,
	publishItems,
	inventorySceneProbe as sceneState,
} from "./createInventoryRuntimeFx.test/fixture";
import type { GameTransition } from "./createInventoryRuntimeFx.test/fixture";

describe("Inventory runtime / feedback and hydration", () => {
	it("keeps Inventory travel running through unrelated committed transitions", async () => {
		const { actor, runtime } = await mountScene();
		const initialX = actor.container.x;
		sceneState.deferFiniteTweens = true;
		sceneState.finiteTweenProgress = 0.25;
		const moved = moveInventoryItem(1);

		publishItems([
			moved,
		]);
		const presentedX = actor.container.x;
		expect(presentedX).toBeGreaterThan(initialX);
		expect(sceneState.pendingTweenCompletions).toHaveLength(1);

		for (let tick = 0; tick < 4; tick += 1) {
			publishItems([
				moved,
			]);
		}

		expect(sceneState.pendingTweenCompletions).toHaveLength(1);
		expect(actor.container.x).toBe(presentedX);
		sceneState.pendingTweenCompletions[0]?.();
		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize);
		await Effect.runPromise(runtime.closeFx);
	});
	it("lands at the latest Inventory slot when retargeting is first sampled on the final frame", async () => {
		const { actor, runtime } = await mountScene();
		const initialX = actor.container.x;
		sceneState.deferFiniteTweens = true;
		sceneState.finiteTweenProgress = 0.25;
		publishItems([
			moveInventoryItem(1),
		]);
		publishItems([
			moveInventoryItem(2),
		]);

		expect(sceneState.pendingTweenCompletions).toHaveLength(1);
		sceneState.pendingTweenCompletions[0]?.();
		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize * 2);
		await Effect.runPromise(runtime.closeFx);
	});
	it("owns and drains the same running particle effect as the Board scene", async () => {
		sceneState.items = [
			{
				...inventoryItem,
				running: true,
				activityEffect: true,
			},
		];
		const { actor, runtime } = await mountScene();

		expect(actor.activityParticles.container).toMatchObject({
			visible: true,
		});
		expect(actor.activityParticles.particles[0]?.particle.texture).toBe(
			sceneState.particleTextures.star,
		);

		publishItems([
			{
				...inventoryItem,
				running: false,
				activityEffect: false,
			},
		]);
		expect(actor.activityParticles.container).toMatchObject({
			visible: false,
		});

		await Effect.runPromise(runtime.closeFx);
		expect(sceneState.particleTextureClose).toHaveBeenCalledOnce();
	});
	it("dips a surviving Inventory source from a committed input-consumption fact", async () => {
		sceneState.deferFiniteTweens = true;
		const { actor, runtime } = await mountScene();
		const current = sceneState.transition;
		if (current === null) throw new Error("Test transition is missing.");
		const transition = {
			events: [
				{
					type: "item:input-stored",
					sourceItemId: inventoryItem.id,
					canonicalItemId: inventoryItem.itemId,
					previousSourceLocation: inventoryItem.location,
					previousQuantity: 4,
					storedQuantity: 1,
					resultingQuantity: 3,
					ownerItemId: "runtime:producer",
					lineId: "line:default",
					inputIndex: 0,
				},
			],
			previousRuntime: current.runtime,
			runtime: {
				currentSpace: 0,
			} as never,
			sequence: current.sequence + 1,
		} satisfies GameTransition;
		sceneState.items = [
			{
				...inventoryItem,
				quantity: 3,
				revision: "revision:water:3",
			},
		];
		sceneState.transition = transition;
		sceneState.transitionListener?.(transition);

		expect(actor.item.quantity).toBe(3);
		expect(actor.container.alpha).toBeCloseTo(0.42);
		await Effect.runPromise(runtime.closeFx);
	});
	it("hydrates historical Inventory feedback without replaying its animation", async () => {
		sceneState.deferFiniteTweens = true;
		sceneState.items = [
			{
				...inventoryItem,
				quantity: 3,
				revision: "revision:water:historical",
			},
		];
		sceneState.transition = {
			events: [
				{
					type: "item:input-stored",
					sourceItemId: inventoryItem.id,
					canonicalItemId: inventoryItem.itemId,
					previousSourceLocation: inventoryItem.location,
					previousQuantity: 4,
					storedQuantity: 1,
					resultingQuantity: 3,
					ownerItemId: "runtime:producer",
					lineId: "line:default",
					inputIndex: 0,
				},
			],
			previousRuntime: null,
			runtime: {
				currentSpace: 0,
			} as never,
			sequence: 8,
		};
		const baseGame = createGame();
		const replayingGame = {
			...baseGame,
			subscribeTransitionsFn: (listener: (transition: GameTransition) => void) => {
				sceneState.transitionListener = listener;
				if (sceneState.transition !== null) listener(sceneState.transition);
				return () => {
					if (sceneState.transitionListener === listener) {
						sceneState.transitionListener = null;
					}
				};
			},
		} as unknown as GameEngine;

		const { actor, runtime } = await mountScene({
			game: replayingGame,
		});

		expect(actor.item.quantity).toBe(3);
		expect(actor.container.alpha).toBe(1);
		expect(sceneState.pendingTweenCompletions).toEqual([]);
		await Effect.runPromise(runtime.closeFx);
	});
});
