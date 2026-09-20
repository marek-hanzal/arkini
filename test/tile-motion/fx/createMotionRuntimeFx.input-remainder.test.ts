// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";

import {
	createMotionHarness,
	createActorMap,
	createItemMap,
	firstBoardLocation,
	secondBoardLocation,
	createItem,
	createActor,
	samplePoseAnimation,
	advanceInputRemainderFlash,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

const inputCue = ({
	previousQuantity,
	resultingQuantity,
	sequence,
}: {
	readonly previousQuantity: number;
	readonly resultingQuantity: number;
	readonly sequence: number;
}): Extract<
	TileMotionCue,
	{
		readonly kind: "input";
	}
> => ({
	canonicalItemId: "runtime:input-source",
	eventIndex: 0,
	kind: "input",
	originActorId: "runtime:input-source",
	originLocation: firstBoardLocation,
	previousQuantity,
	resultingQuantity,
	sequence,
	sourceActorId: "runtime:input-source",
	staggerIndex: 0,
	storedQuantity: previousQuantity - resultingQuantity,
	targetActorId: "runtime:input-owner",
	targetLocation: secondBoardLocation,
});

describe("input remainder travel", () => {
	it("chases a moving input owner and returns its remainder to the stable engine origin", () => {
		const source = createActor("runtime:input-source");
		const owner = createActor("runtime:input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			badgeCount: 7,
			quantity: 7,
		};
		source.currentVisual.item = source.item;
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(125, 40);
		source.container.alpha = 1;
		source.container.eventMode = "static";
		source.lifecycleLayer.position.set(5, -4);
		owner.container.position.set(200, 40);
		owner.container.alpha = 1;
		const canonicalSource = {
			...source.item,
			quantity: 2,
			revision: "revision:input-source:stored",
		};
		const actors = createActorMap(source, owner);
		const canonicalItems = createItemMap(canonicalSource, owner.item);
		const { animations, runtime } = createMotionHarness({
			actors,
			canonicalItems,
		});
		const cue = inputCue({
			previousQuantity: 7,
			resultingQuantity: 2,
			sequence: 40,
		});
		const effectivePoseBeforeSetup = {
			x: source.container.x + source.lifecycleLayer.x * source.container.scale.x,
			y: source.container.y + source.lifecycleLayer.y * source.container.scale.y,
		};

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.syncPresentationFx);
		Effect.runSync(runtime.startFx);

		expect(source.item.quantity).toBe(7);
		expect(source.container.alpha).toBe(1);
		expect({
			x: source.container.x + source.lifecycleLayer.x * source.container.scale.x,
			y: source.container.y + source.lifecycleLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeSetup);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map([
				[
					source.item.id,
					"blocked",
				],
			]),
			retainedActorIds: new Set([
				source.item.id,
				owner.item.id,
			]),
			quantityPresentationByActorId: new Map([
				[
					source.item.id,
					{
						kind: "exact",
						quantity: 7,
					},
				],
			]),
		});
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:40:0",
		);
		if (firstTravel?.channel !== "pose") throw new Error("Expected first delivery segment.");
		expect(firstTravel).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
		});
		const transient = firstTravel.actor;
		expect(transient).toBe(source);
		expect(transient.item.quantity).toBe(7);
		expect(transient.container.x).toBe(125);
		samplePoseAnimation(firstTravel, 1);
		owner.container.x = 340;
		firstTravel.onCompleteFn?.();

		const travelSegments = animations.filter(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "pose" &&
				animation.ownerKey === "motion:40:0",
		);
		expect(travelSegments).toHaveLength(2);
		const finalTravel = travelSegments[1];
		if (finalTravel?.channel !== "pose") throw new Error("Expected retargeted segment.");
		expect(finalTravel).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
			delayMs: 0,
		});
		samplePoseAnimation(finalTravel, 1);
		source.dragging = true;
		finalTravel.onCompleteFn?.();

		expect(source.item.quantity).toBe(7);
		const flash = advanceInputRemainderFlash({
			actor: transient,
			animations,
			cancelFadeIn: true,
			cueKey: "40:0",
		});
		expect(flash.fadeOut.durationMs).toBe(275);
		expect(flash.quantityBeforeFadeOut).not.toBe(2);
		expect(flash.quantityAfterFadeOut).toBe(2);
		expect(flash.badgeCountAfterFadeOut).toBe(2);
		expect(flash.fadeIn.durationMs).toBe(375);
		expect(flash.quantityAfterFadeIn).toBe(2);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map([
				[
					source.item.id,
					{
						kind: "exact",
						quantity: 2,
					},
				],
			]),
		);
		Effect.runSync(runtime.syncPresentationFx);
		expect(source.item.quantity).toBe(2);
		expect(source.item.badgeCount).toBe(2);
		expect(source.container.alpha).toBe(1);
		expect(transient.item.quantity).toBe(2);
		const returnTravel = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:40:0",
			)
			.at(-1);
		if (returnTravel?.channel !== "pose") throw new Error("Expected the remainder return.");
		expect(returnTravel).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(returnTravel.durationMs).toBe(
			readTravelDurationMsFn({
				fromX: 340,
				fromY: 40,
				tileSize: 80,
				toX: 100,
				toY: 40,
			}),
		);
		expect(samplePoseAnimation(returnTravel, 1)).toEqual({
			scale: 1,
			x: 100,
			y: 40,
		});
		const effectivePoseBeforeCompletion = {
			x: source.container.x + source.lifecycleLayer.x * source.container.scale.x,
			y: source.container.y + source.lifecycleLayer.y * source.container.scale.y,
		};
		source.dragging = false;
		returnTravel.onCompleteFn?.();

		expect(transient.container.destroyed).toBe(false);
		expect(source.item.quantity).toBe(2);
		expect(source.container.x).toBe(100);
		expect(source.container.alpha).toBe(1);
		expect(source.lifecycleLayer.scale.x).toBe(1);
		expect(source.container.eventMode).toBe("static");
		expect({
			x: source.container.x + source.lifecycleLayer.x * source.container.scale.x,
			y: source.container.y + source.lifecycleLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeCompletion);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map(),
			retainedActorIds: new Set(),
			quantityPresentationByActorId: new Map(),
		});
		expect(
			animations.filter(
				(animation) =>
					animation.actor === owner && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		Effect.runSync(runtime.closeFx);
	});

	it.each([
		"hidden",
		"revealing",
	])("retires a remainder removed while %s", (phase) => {
		const source = createActor("runtime:input-source");
		const owner = createActor("runtime:input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			quantity: 7,
		};
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(100, 40);
		owner.container.position.set(200, 40);
		const actors = createActorMap(source, owner);
		const canonicalItems = createItemMap(
			{
				...source.item,
				quantity: 2,
			},
			owner.item,
		);
		const { animations, runtime } = createMotionHarness({
			actors,
			canonicalItems,
		});
		Effect.runSync(
			runtime.enqueueFx([
				inputCue({
					previousQuantity: 7,
					resultingQuantity: 2,
					sequence: 40,
				}),
			]),
		);
		Effect.runSync(runtime.startFx);
		const arrival = animations.find(
			(animation) => animation.actor === source && animation.channel === "pose",
		);
		if (arrival?.channel !== "pose") throw new Error("Expected arrival");
		samplePoseAnimation(arrival, 1);
		arrival.onCompleteFn?.();
		const fadeOut = animations.find(
			(animation) =>
				animation.actor === source &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (!fadeOut) throw new Error("Expected consumption fade");
		if (phase === "hidden") canonicalItems.delete(source.item.id);
		fadeOut.onCompleteFn?.();
		if (phase === "revealing") {
			// Return starts with reveal, not after it. Neither callback may revive a deleted source.
			const returning = animations
				.filter((animation) => animation.actor === source && animation.channel === "pose")
				.at(-1);
			expect(returning).not.toBe(arrival);
			const fadeIn = animations.find(
				(animation) =>
					animation.actor === source &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 1,
			);
			if (!fadeIn) throw new Error("Expected reveal");
			canonicalItems.delete(source.item.id);
			fadeIn.onCompleteFn?.();
			returning?.onCompleteFn?.();
		} else {
			expect(
				animations.filter(
					(animation) => animation.actor === source && animation.channel === "pose",
				),
			).toHaveLength(1);
		}
		expect(source.container.destroyed).toBe(true);
		expect(actors.has(source.item.id)).toBe(false);
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		Effect.runSync(runtime.closeFx);
	});

	it.each([
		false,
		true,
	])("settles remainder ownership when fade-out cancellation is %s", (cancelFadeOut) => {
		const source = createActor("runtime:input-source");
		const owner = createActor("runtime:input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			quantity: 7,
		};
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(100, 40);
		owner.container.position.set(200, 40);
		const { animations, runtime } = createMotionHarness({
			actors: createActorMap(source, owner),
			canonicalItems: createItemMap(
				{
					...source.item,
					quantity: 2,
				},
				owner.item,
			),
		});
		Effect.runSync(
			runtime.enqueueFx([
				inputCue({
					previousQuantity: 7,
					resultingQuantity: 2,
					sequence: 40,
				}),
			]),
		);
		Effect.runSync(runtime.startFx);
		const arrival = animations.find(
			(animation) => animation.actor === source && animation.channel === "pose",
		);
		if (arrival?.channel !== "pose") throw new Error("Expected arrival");
		samplePoseAnimation(arrival, 1);
		arrival.onCompleteFn?.();
		const fadeOut = animations.find(
			(animation) =>
				animation.actor === source &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		(cancelFadeOut ? fadeOut?.onCancelFn : fadeOut?.onCompleteFn)?.();
		const returning = animations
			.filter((animation) => animation.actor === source && animation.channel === "pose")
			.at(-1);
		if (returning?.channel !== "pose" || returning === arrival)
			throw new Error("Expected concurrent return");
		samplePoseAnimation(returning, 1);
		returning.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.has(source.item.id)).toBe(
			!cancelFadeOut,
		);
		const fadeIn = animations.find(
			(animation) =>
				animation.actor === source &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 1,
		);
		fadeIn?.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.has(source.item.id)).toBe(
			false,
		);
		expect(source.container.destroyed).toBe(false);
		Effect.runSync(runtime.closeFx);
	});

	it("keeps a source at its oldest unsettled input quantity", () => {
		const { runtime } = createMotionHarness();
		Effect.runSync(
			runtime.enqueueFx([
				inputCue({
					previousQuantity: 7,
					resultingQuantity: 6,
					sequence: 40,
				}),
				inputCue({
					previousQuantity: 6,
					resultingQuantity: 5,
					sequence: 41,
				}),
			]),
		);

		expect(
			Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId.get(
				"runtime:input-source",
			),
		).toEqual({
			kind: "exact",
			quantity: 7,
		});
		Effect.runSync(runtime.closeFx);
	});
});
