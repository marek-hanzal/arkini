// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/ui/pixi/animation/runActorLifecycleFx";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";

import {
	createActor,
	samplePoseAnimation,
	advanceStackMergeVanish,
	createStackHarness,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion stack contact", () => {
	it("launches produced payloads from the held producer's live presentation pose", () => {
		const { actors, animations, cue, runtime } = createStackHarness();
		const producer = createActor(cue.originActorId);
		producer.dragging = true;
		producer.container.position.set(460, 300);
		producer.container.pivot.set(16, 12);
		producer.container.scale.set(1.25);
		producer.offsetLayer.position.set(5, -4);
		actors.set(producer.item.id, producer);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		expect(travel.actor.container).toMatchObject({
			x: 446.25,
			y: 280,
		});
		expect(travel.actor.container.scale.x).toBe(1.25);
		expect(travel.actor.container.x).not.toBe(100);
		expect(travel.actor.container.y).not.toBe(40);

		Effect.runSync(runtime.closeFx);
	});

	it("travels continuously to live stack contact before vanish", () => {
		const { animations, cue, magneticReleases, runtime, target } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");

		target.container.x = 260;
		samplePoseAnimation(travel, 0.8);
		target.container.x = 600;
		samplePoseAnimation(travel, 0.9);
		samplePoseAnimation(travel, 0.95);
		expect(travel.actor.container.x).not.toBe(target.container.x);
		expect(
			animations.some(
				(animation) =>
					animation.actor === travel.actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0,
			),
		).toBe(false);

		const contact = samplePoseAnimation(travel, 1);
		expect(contact).toMatchObject({
			x: target.container.x,
			y: target.container.y,
		});
		expect(travel.actor.container.scale.x).toBe(target.container.scale.x);
		expect(magneticReleases).not.toContainEqual({
			sourceActorId: travel.actor.item.id,
			sourceKind: "motion",
		});

		travel.onComplete?.();
		const vanish = advanceStackMergeVanish({
			actor: travel.actor,
			animations,
		});
		expect(vanish.vanishScale.durationMs).toBe(lifecycleDurationMs);
		expect(vanish.vanishScale.toScale).toBeLessThan(1);
		expect(vanish.vanishOpacity.durationMs).toBe(lifecycleDurationMs);
		expect(travel.actor.container.destroyed).toBe(true);
		expect(target.item.quantity).toBe(2);
		expect(magneticReleases).toContainEqual({
			sourceActorId: travel.actor.item.id,
			sourceKind: "motion",
		});
		Effect.runSync(runtime.closeFx);
	});

	it("stacks a consumed source with its one retained physical actor", () => {
		const { actors, animations, animator, canonicalItems, cue, runtime, target } =
			createStackHarness();
		const source = createActor(cue.originActorId);
		source.item = {
			...source.item,
			itemId: cue.canonicalItemId,
			quantity: cue.quantity,
		};
		source.container.alpha = 1;
		source.container.position.set(100, 40);
		source.container.pivot.set(30, 18);
		actors.set(source.item.id, source);
		canonicalItems.delete(source.item.id);
		Effect.runSync(
			startActorExitFx({
				actor: source,
				animator,
			}),
		);
		source.container.alpha = 0.35;

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected the source stack travel.");
		expect(travel.actor).toBe(source);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === source && animation.channel === "lifecycle-opacity",
			),
		).toEqual([
			expect.objectContaining({
				toAlpha: 0,
			}),
			expect.objectContaining({
				toAlpha: 1,
			}),
		]);
		expect(source.lifecycleTargetAlpha).toBe(1);
		samplePoseAnimation(travel, 1);
		expect({
			x: source.container.x - source.container.pivot.x * source.container.scale.x,
			y: source.container.y - source.container.pivot.y * source.container.scale.y,
		}).toEqual({
			x: target.container.x - target.container.pivot.x * target.container.scale.x,
			y: target.container.y - target.container.pivot.y * target.container.scale.y,
		});
		travel.onComplete?.();
		advanceStackMergeVanish({
			actor: source,
			animations,
		});

		expect(source.container.destroyed).toBe(true);
		expect(actors.has(source.item.id)).toBe(false);
		expect(target.item.quantity).toBe(2);
		Effect.runSync(runtime.closeFx);
	});
});
