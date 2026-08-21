import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import {
	pixiTileActorLifecycleDurationMs,
	pixiTileActorLifecycleReducedScale,
} from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { burstPixiTileActorAckParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	inventoryLocation,
	__fixture_projectionState as projectionState,
	transition,
} from "./PixiMainSceneReconciler.test/fixture";

describe("Pixi main-scene reconciliation / feedback acknowledgements", () => {
	it("retains a pending source, then fades it while bursting the Inventory receiver", () => {
		const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
		const source = createItem("runtime:water-source", boardLocation);
		const inventorySpawn = createItem("runtime:water-inventory-new-id", inventoryLocation);
		const inventory = createItem("runtime:backpack", boardLocation);
		const actor = createActor(source);
		const harness = createReconcilerHarness({
			actor,
		});
		const inventoryActor = createActor(inventory);
		harness.actors.set(inventory.id, inventoryActor);
		harness.canonicalItems.set(inventory.id, inventory);
		const dropGeneration = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: source.id,
				swapCandidate: null,
			}),
		);
		projectionState.inventory = [
			inventorySpawn,
		];
		projectionState.main = [
			inventory,
		];
		actor.container.alpha = 0.37;
		actor.lifecycleDurationMs = pixiTileActorLifecycleDurationMs;
		actor.lifecycleTransitionStarted = true;
		actor.lifecycleNotBeforeMs = 900;
		actor.lifecycleTargetAlpha = 0;
		const remainingLifecycleDurationMs =
			actor.lifecycleNotBeforeMs + actor.lifecycleDurationMs - performance.now();

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.actors.get(source.id)).toBe(actor);
		expect(harness.detached).toEqual([]);
		expect(harness.animations).toEqual([]);
		expect(actor.container.alpha).toBe(0.37);

		const result = {
			kind: "store-inventory",
			source: {
				itemId: source.id,
				canonicalItemId: source.itemId,
				previousRevision: source.revision,
				previousLocation: source.location,
				previousQuantity: source.quantity,
				current: null,
			},
			inventory: {
				itemId: "runtime:backpack",
				revision: "revision:backpack",
				location: boardLocation,
			},
		} satisfies runTileDropAtom.Result;
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation: dropGeneration,
				result,
			}),
		);
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.actors.has(source.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(harness.canceledActors).toEqual([
			actor,
		]);
		expect(actor.container.alpha).toBe(0.37);
		expect(actor.container.destroyed).toBe(false);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: remainingLifecycleDurationMs,
				toAlpha: 0,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-scale",
				durationMs: remainingLifecycleDurationMs,
				toScale: pixiTileActorLifecycleReducedScale,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor: inventoryActor,
				channel: "activity-particles",
				durationMs: 720,
			}),
		);
		expect(Effect.runSync(harness.dropPresentation.readSnapshotFx).feedback).toEqual([]);

		const exit = harness.animations.find(
			(animation) =>
				animation.actor === actor &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		const destroy = vi.spyOn(actor.container, "destroy");
		exit?.onComplete?.();
		exit?.onComplete?.();
		expect(destroy).toHaveBeenCalledOnce();
		expect(actor.container.destroyed).toBe(true);
		expect(actor.visuals.size).toBe(0);
		now.mockRestore();
	});
	it("bursts a surviving committed feedback receiver exactly once", () => {
		const item = createItem("runtime:tree", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			item,
		];
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "2:0:resource-spent",
				kind: "resource-spent",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${actor.instanceId}`,
			}),
		);
		const animationCount = harness.animations.length;

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toHaveLength(animationCount);
	});
	it("keeps a success ACK alive across an instant running-to-idle transition", () => {
		const idle = createItem("runtime:producer", boardLocation);
		const running = {
			...idle,
			revision: "revision:producer:running",
			running: true,
			activityEffect: true,
		} satisfies TileActorItem;
		const settled = {
			...idle,
			revision: "revision:producer:settled",
		} satisfies TileActorItem;
		const actor = createActor(idle);
		const harness = createReconcilerHarness({
			actor,
		});
		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
				actor,
				animator: harness.animator,
				tint: 0x57d7b2,
			}),
		);
		projectionState.main = [
			running,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);

		projectionState.main = [
			settled,
		];
		projectionState.feedback = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
	});
});
