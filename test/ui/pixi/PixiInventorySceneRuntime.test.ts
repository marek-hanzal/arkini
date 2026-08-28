// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { pixiTileActorConsumedSourceFadeDurationMs } from "~/ui/pixi/animation/flashConsumedSourceFx";
import type { GameEngine } from "~/bridge/game/GameEngine";

import {
	createGame,
	inventoryItem,
	mountScene,
	publishItems,
	__fixture_sceneState as sceneState,
} from "./PixiInventorySceneRuntime.test/fixture";
import type { GameTransition } from "./PixiInventorySceneRuntime.test/fixture";

describe("Pixi Inventory scene runtime / feedback and hydration", () => {
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
		sceneState.deferredTweenDurations.add(pixiTileActorConsumedSourceFadeDurationMs);
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
		sceneState.deferredTweenDurations.add(pixiTileActorConsumedSourceFadeDurationMs);
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
			subscribeTransitions: (listener: (transition: GameTransition) => void) => {
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
