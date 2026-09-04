import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { MotionRuntime } from "~/tile-motion/service/MotionRuntime";
import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import type { TileDelivery } from "~/game-scene/fx/readTileDeliveriesFx";

import {
	boardLocation,
	createActor,
	createItem,
	createMotion,
	createReconcilerHarness,
	projectionProbeState as projectionState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / delivery retention", () => {
	it("retires spawn ownership before a delivery replaces its pose writer", () => {
		const actor = createActor(createItem("water", boardLocation));
		let handedOff = false;
		const delivery = {
			item: actor.item,
		} as TileDelivery;
		const harness = createReconcilerHarness({
			actor,
			viewedDeliveries: [
				delivery,
			],
			motion: {
				...createMotion(),
				handoffDeliveriesFx: (ids) =>
					Effect.sync(() => {
						expect(ids).toEqual(
							new Set([
								actor.item.id,
							]),
						);
						handedOff = true;
					}),
			},
			syncDeliveryFx: (deliveries) =>
				Effect.sync(() => {
					expect(handedOff).toBe(true);
					expect(deliveries).toEqual([
						delivery,
					]);
				}),
		});
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(handedOff).toBe(true);
	});
	it("holds an input source at its pre-contact quantity and suppresses early feedback", () => {
		const previous = createItem("runtime:input-source", boardLocation, {
			badgeCount: 7,
			quantity: 7,
			revision: "revision:input-source:7",
		});
		const current = createItem(previous.id, boardLocation, {
			badgeCount: 2,
			quantity: 2,
			revision: "revision:input-source:2",
		});
		const actor = createActor(previous);
		const motion = {
			...createMotion(),
			readSnapshotFx: Effect.succeed({
				interactionClaimByActorId: new Map([
					[
						previous.id,
						"activation-only" as const,
					],
				]),
				retainedActorIds: new Set([
					previous.id,
					"runtime:owner",
				]),
				spawnCueByActorId: new Map(),
				quantityPresentationByActorId: new Map([
					[
						previous.id,
						{
							kind: "exact",
							quantity: 7,
						},
					],
				]),
			}),
		} satisfies MotionRuntime;
		const harness = createReconcilerHarness({
			actor,
			motion,
		});
		projectionState.main = [
			current,
		];
		projectionState.cues = [
			{
				canonicalItemId: previous.itemId,
				eventIndex: 0,
				kind: "input",
				originActorId: previous.id,
				originLocation: boardLocation,
				previousQuantity: 7,
				storedQuantity: 5,
				resultingQuantity: 2,
				sequence: 2,
				sourceActorId: previous.id,
				staggerIndex: 0,
				targetActorId: "runtime:owner",
				targetLocation: boardLocation,
			},
		];
		projectionState.feedback = [
			{
				actorId: previous.id,
				key: "2:0:consume-source",
				kind: "consume-source",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(actor.item.quantity).toBe(7);
		expect(actor.currentVisual.item.badgeCount).toBe(7);
		expect(
			harness.animations.some(
				(animation) =>
					animation.actor === actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0.42,
			),
		).toBe(false);
	});
	it("keeps a resolved line owner alive until its last input presentation settles", () => {
		const owner = createItem("runtime:resolved-craft", boardLocation);
		const actor = createActor(owner);
		const retainedActorIds = new Set([
			owner.id,
		]);
		const motion = {
			...createMotion(),
			readSnapshotFx: Effect.sync(() => ({
				interactionClaimByActorId: new Map(),
				retainedActorIds,
				spawnCueByActorId: new Map(),
				quantityPresentationByActorId: new Map(),
			})),
		} satisfies MotionRuntime;
		const harness = createReconcilerHarness({
			actor,
			motion,
		});
		projectionState.main = [];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.actors.get(owner.id)).toBe(actor);
		expect(harness.detached).toEqual([]);
		expect(harness.animations).toEqual([]);

		retainedActorIds.clear();
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.actors.has(owner.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 0,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
			}),
		);
	});
	it("keeps a canonical board transport above masks until it reaches its destination", () => {
		const previous = createItem("runtime:moving-water", boardLocation);
		const current = createItem(previous.id, {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		});
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(actor.container.parent).toBe(harness.transientActorLayer);
		const travel = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a canonical pose travel.");
		expect(actor.container.parent).not.toBe(harness.layer);

		travel.onCompleteFn?.();
		expect(actor.container.parent).toBe(harness.layer);
	});
});
