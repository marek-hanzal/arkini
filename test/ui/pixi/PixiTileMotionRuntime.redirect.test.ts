// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { pixiTileActorRemovalFeedbackDurationMs } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";

import {
	inventoryLocation,
	secondBoardLocation,
	createItem,
	createActor,
	samplePoseAnimation,
	advanceStackMergeVanish,
	createStackHarness,
} from "~test/ui/pixi/PixiTileMotionRuntime.test/fixture";

describe("Pixi motion target redirection", () => {
	it("follows a consumed held target into its redirected sink before vanishing", () => {
		const {
			actors,
			animations,
			canonicalItems,
			cue,
			magneticReleases,
			magneticUpdates,
			runtime,
			target,
		} = createStackHarness();
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
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		const inventory = createActor("runtime:inventory");
		inventory.item = createItem(inventory.item.id, inventoryLocation);
		inventory.container.position.set(640, 320);
		actors.set(inventory.item.id, inventory);
		canonicalItems.set(inventory.item.id, inventory.item);

		samplePoseAnimation(travel, 0.4);
		Effect.runSync(
			runtime.redirectTargetFx({
				sourceActorId: target.item.id,
				targetActorId: inventory.item.id,
				targetLocation: inventory.item.location,
			}),
		);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map([
				[
					inventory.item.id,
					{
						kind: "subtract",
						quantity: 1,
					},
				],
			]),
		);
		canonicalItems.delete(target.item.id);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const redirectedTravel = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:30:0",
			)
			.at(-1);
		if (redirectedTravel?.channel !== "pose" || redirectedTravel === travel) {
			throw new Error("Expected redirected sink chase.");
		}
		expect(samplePoseAnimation(redirectedTravel, 1)).toEqual({
			scale: 1,
			x: 640,
			y: 320,
		});
		redirectedTravel.onComplete?.();

		expect(magneticUpdates.length).toBeGreaterThan(0);
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: inventory.item.id,
			eligibleAttractionActorIds: new Set([
				inventory.item.id,
			]),
		});
		expect(magneticReleases).toEqual([]);
		expect(transient.container.destroyed).toBe(false);
		expect(destroy).not.toHaveBeenCalled();
		const vanishOpacity = animations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (vanishOpacity?.channel !== "lifecycle-opacity") {
			throw new Error("Expected redirected payload fade-out.");
		}
		expect(vanishOpacity.durationMs).toBe(pixiTileActorRemovalFeedbackDurationMs);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId.size).toBe(1);
		vanishOpacity.onComplete?.();

		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: transient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toHaveLength(1);
	});

	it("retargets a replacement stack actor and publishes contact only on the surviving instance", () => {
		const { actors, animations, cue, magneticReleases, runtime, target } = createStackHarness();
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
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		const replacement = createActor(target.item.id);
		replacement.item = createItem(replacement.item.id, secondBoardLocation);
		replacement.container.position.set(480, 140);

		samplePoseAnimation(travel, 0.6);
		actors.set(target.item.id, replacement);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const contact = animations
			.filter((animation) => animation.actor === transient && animation.channel === "pose")
			.at(-1);
		if (contact?.channel !== "pose") throw new Error("Expected a replacement chase segment.");
		expect(contact).not.toBe(travel);
		expect(samplePoseAnimation(contact, 1)).toEqual({
			scale: 1,
			x: 480,
			y: 140,
		});
		contact.onComplete?.();
		advanceStackMergeVanish({
			actor: transient,
			animations,
		});

		expect(target.item.quantity).toBe(1);
		expect(replacement.item.quantity).toBe(2);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === target && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === replacement && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		expect(magneticReleases).toEqual([
			{
				sourceActorId: transient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();

		Effect.runSync(runtime.closeFx);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toHaveLength(1);
	});
});
