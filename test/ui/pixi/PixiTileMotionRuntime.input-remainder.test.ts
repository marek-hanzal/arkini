// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { pixiTileActorLifecycleDurationMs } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";

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
} from "~test/ui/pixi/PixiTileMotionRuntime.test/fixture";

describe("Pixi tile input remainder travel", () => {
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
		source.offsetLayer.position.set(5, -4);
		owner.container.position.set(200, 40);
		owner.container.alpha = 1;
		const canonicalSource = {
			...source.item,
			quantity: 2,
			revision: "revision:input-source:stored",
		};
		const actors = createActorMap(source, owner);
		const canonicalItems = createItemMap(canonicalSource, owner.item);
		const { animations, magneticReleases, magneticUpdates, runtime } = createMotionHarness({
			actors,
			canonicalItems,
		});
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 7,
			storedQuantity: 5,
			resultingQuantity: 2,
			sequence: 40,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		const effectivePoseBeforeSetup = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
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
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeSetup);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map([
				[
					source.item.id,
					"activation-only",
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
		firstTravel.onComplete?.();

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
		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(0);
		samplePoseAnimation(finalTravel, 1);
		source.dragging = true;
		finalTravel.onComplete?.();

		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(1);
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
			Effect.runSync(
				readPixiTileTravelDurationMsFx({
					fromX: 340,
					fromY: 40,
					tileSize: 80,
					toX: 100,
					toY: 40,
				}),
			),
		);
		expect(samplePoseAnimation(returnTravel, 1)).toEqual({
			scale: 1,
			x: 100,
			y: 40,
		});
		const effectivePoseBeforeCompletion = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		source.dragging = false;
		returnTravel.onComplete?.();

		expect(transient.container.destroyed).toBe(false);
		expect(source.item.quantity).toBe(2);
		expect(source.container.x).toBe(100);
		expect(source.container.alpha).toBe(1);
		expect(source.lifecycleLayer.scale.x).toBe(1);
		expect(source.container.eventMode).toBe("static");
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: source,
				channel: "lifecycle-scale",
				durationMs: pixiTileActorLifecycleDurationMs,
				toScale: 1,
			}),
		);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: source,
				channel: "lifecycle-opacity",
				durationMs: pixiTileActorLifecycleDurationMs,
				toAlpha: 1,
			}),
		);
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
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
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: null,
			eligibleAttractionActorIds: new Set([
				source.item.id,
			]),
			sourceActorId: transient.item.id,
			sourceKind: "motion",
		});
		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(2);
		Effect.runSync(runtime.closeFx);
	});
});
