import { describe, expect, it } from "vitest";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { Effect } from "effect";
import { pixiTileActorLifecycleReducedScale } from "~/ui/pixi/animation/runActorLifecycleFx";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	__fixture_projectionState as projectionState,
	transition,
} from "./PixiMainSceneReconciler.test/fixture";

describe("Pixi main-scene reconciliation / work and consumption", () => {
	it("dims a craft as soon as its active job starts collecting inputs", () => {
		const idle = createItem("runtime:craft", boardLocation, {
			itemType: TypeSchema.enum.Craft,
		});
		const collecting = createItem(idle.id, boardLocation, {
			itemType: TypeSchema.enum.Craft,
			jobStatus: JobStatusEnumSchema.enum.Paused,
		});
		const actor = createActor(idle);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			collecting,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.animations.find(({ channel }) => channel === "crowd-opacity")).toMatchObject(
			{
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: `running:${actor.item.id}`,
				toCrowdAlpha: 0.6,
			},
		);
	});
	it("dips a surviving consumed source and restores only that lifecycle intent", () => {
		const item = createItem("runtime:ore", boardLocation, {
			quantity: 2,
			revision: "revision:ore:2",
		});
		const actor = createActor(
			createItem(item.id, boardLocation, {
				quantity: 3,
				revision: "revision:ore:3",
			}),
		);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			item,
		];
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "2:0:consume-source",
				kind: "consume-source",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const dip = harness.animations.find(
			(animation) =>
				animation.actor === actor &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0.42,
		);
		expect(dip).toMatchObject({
			durationMs: 130,
			ownerKey: `actor-alpha:${actor.instanceId}`,
		});

		dip?.onComplete?.();
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 360,
				ownerKey: `actor-alpha:${actor.instanceId}`,
				toAlpha: 1,
			}),
		);
	});
	it("starts terminal deposit feedback before its longer fade-off releases the actor", () => {
		const item = createItem("runtime:depleted-tree", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "3:0:resource-spent",
				kind: "resource-spent",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.animations[0]).toMatchObject({
			actor,
			channel: "activity-particles",
			durationMs: 720,
			ownerKey: `activity-particles:${actor.instanceId}`,
		});
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 720,
				toAlpha: 0,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-scale",
				durationMs: 720,
				toScale: pixiTileActorLifecycleReducedScale,
			}),
		);
		expect(actor.container.destroyed).toBe(false);
	});
});
