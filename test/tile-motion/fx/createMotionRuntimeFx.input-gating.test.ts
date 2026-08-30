// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/ui/pixi/animation/runActorLifecycleFx";

import {
	createMotionHarness,
	firstBoardLocation,
	secondBoardLocation,
	createItem,
	createActor,
	samplePoseAnimation,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

describe("input-gated owner output", () => {
	it("gates resolved owner output after the last input without returning a stale remainder", () => {
		const source = createActor("runtime:consumed-input-source");
		const owner = createActor("runtime:consumed-input-owner");
		const output = createActor("runtime:consumed-input-output");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			quantity: 3,
		};
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(100, 40);
		source.container.alpha = 1;
		owner.container.position.set(200, 40);
		owner.container.alpha = 1;
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				owner.item.id,
				owner,
			],
			[
				output.item.id,
				output,
			],
		]);
		const canonicalItems = new Map([
			[
				output.item.id,
				output.item,
			],
		]);
		const { animations, runtime } = createMotionHarness({
			actors,
			canonicalItems,
		});
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 3,
			storedQuantity: 2,
			resultingQuantity: 1,
			sequence: 41,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		const finalCue = {
			...cue,
			previousQuantity: 1,
			storedQuantity: 1,
			resultingQuantity: 0,
			sequence: 42,
		} satisfies TileMotionCue;
		const outputCue = {
			actorId: output.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: owner.item.id,
			originLocation: secondBoardLocation,
			sequence: 43,
			staggerIndex: 0,
			targetLocation: firstBoardLocation,
		} satisfies TileMotionCue;

		Effect.runSync(
			runtime.enqueueFx([
				cue,
				finalCue,
				outputCue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:41:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected the complete input travel.");
		const transient = travel.actor;
		expect(transient).toBe(source);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const removal = animations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (removal?.channel !== "lifecycle-opacity") {
			throw new Error("Expected the complete input contact fade.");
		}
		expect(
			animations.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:41:0",
			),
		).toHaveLength(1);
		expect(source.container.alpha).toBe(1);
		expect(
			animations.some(
				(animation) =>
					animation.actor === output &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:43:0",
			),
		).toBe(false);
		removal.onComplete?.();

		expect(actors.has(source.item.id)).toBe(false);
		expect(source.container.destroyed).toBe(true);
		expect(transient.container.destroyed).toBe(true);
		expect(
			animations.some(
				(animation) =>
					animation.actor === source &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 1,
			),
		).toBe(false);
		const outputTravel = animations.find(
			(animation) =>
				animation.actor === output &&
				animation.channel === "pose" &&
				animation.ownerKey === "motion:43:0",
		);
		if (outputTravel?.channel !== "pose") {
			throw new Error("Expected output to start after the last input settled.");
		}
		expect(actors.get(owner.item.id)).toBe(owner);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map([
				[
					output.item.id,
					"handoff",
				],
			]),
			retainedActorIds: new Set([
				output.item.id,
				owner.item.id,
			]),
		});

		samplePoseAnimation(outputTravel, 1);
		outputTravel.onComplete?.();

		expect(actors.get(output.item.id)).toBe(output);
		expect(output.container).toMatchObject({
			x: 100,
			y: 40,
		});
		expect(actors.has(owner.item.id)).toBe(false);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map(),
			retainedActorIds: new Set(),
		});
		const ownerExitScale = animations.find(
			(animation) => animation.actor === owner && animation.channel === "lifecycle-scale",
		);
		if (ownerExitScale?.channel !== "lifecycle-scale") {
			throw new Error("Expected the released owner lifecycle scale-down.");
		}
		expect(ownerExitScale).toMatchObject({
			durationMs: lifecycleDurationMs,
		});
		expect(ownerExitScale.toScale).toBeLessThan(1);
		const ownerExitOpacity = animations.find(
			(animation) =>
				animation.actor === owner &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (ownerExitOpacity?.channel !== "lifecycle-opacity") {
			throw new Error("Expected the released owner lifecycle fade-out.");
		}
		expect(ownerExitOpacity.durationMs).toBe(lifecycleDurationMs);
		expect(owner.container.destroyed).toBe(false);
		ownerExitOpacity.onComplete?.();
		expect(owner.container.destroyed).toBe(true);
		Effect.runSync(runtime.closeFx);
	});
});
