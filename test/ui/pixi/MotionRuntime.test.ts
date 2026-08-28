// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { chaseTargetFx } from "~/ui/pixi/motion/chaseTargetFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";

import {
	createSurface,
	secondBoardLocation,
	createItem,
	createActor,
	createRecordingAnimator,
	samplePoseAnimation,
	advanceStackMergeVanish,
	createStackHarness,
	type TileMotionCue,
	type PixiTileActor,
	type ActorAnimation,
	type AnimationChannel,
} from "~test/ui/pixi/MotionRuntime.test/fixture";

describe("motion stack payload", () => {
	it("presents a produced stack payload with its exact delta instead of the target total", () => {
		const { animations, cue, runtime } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				{
					...cue,
					quantity: 2,
				},
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a produced stack payload.");
		expect(travel.actor.item.quantity).toBe(2);
		expect(travel.actor.item.badgeCount).toBe(2);
		Effect.runSync(runtime.closeFx);
	});

	it("isolates concurrent cue payload lifecycles across completion and close", () => {
		const { actors, animations, canonicalItems, cue, runtime } = createStackHarness();
		const secondTarget = createActor("runtime:second-stack-target");
		secondTarget.item = createItem(secondTarget.item.id, {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		});
		actors.set(secondTarget.item.id, secondTarget);
		canonicalItems.set(secondTarget.item.id, {
			...secondTarget.item,
			quantity: 2,
		});
		const secondCue = {
			...cue,
			eventIndex: 1,
			targetActorId: secondTarget.item.id,
			targetLocation: secondTarget.item.location,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				secondCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		const secondTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:1",
		);
		if (firstTravel?.channel !== "pose" || secondTravel?.channel !== "pose") {
			throw new Error("Expected both concurrent stack payloads.");
		}
		const firstDestroy = vi.spyOn(firstTravel.actor.container, "destroy");
		const secondDestroy = vi.spyOn(secondTravel.actor.container, "destroy");

		samplePoseAnimation(firstTravel, 1);
		firstTravel.onComplete?.();
		advanceStackMergeVanish({
			actor: firstTravel.actor,
			animations,
		});

		expect(firstTravel.actor.container.destroyed).toBe(true);
		expect(firstDestroy).toHaveBeenCalledOnce();
		expect(secondTravel.actor.container.destroyed).toBe(false);
		expect(secondDestroy).not.toHaveBeenCalled();

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);

		expect(firstDestroy).toHaveBeenCalledOnce();
		expect(secondTravel.actor.container.destroyed).toBe(true);
		expect(secondDestroy).toHaveBeenCalledOnce();
	});

	it("ignores a queued proximity settlement after the pose writer is superseded", async () => {
		const actor = createActor("runtime:proximity-cancel");
		actor.container.position.set(0, 0);
		const animations: ActorAnimation[] = [];
		const poseState: {
			active: Extract<
				ActorAnimation,
				{
					readonly channel: "pose";
				}
			> | null;
		} = {
			active: null,
		};
		const onSettled = vi.fn();
		const animator = {
			...createRecordingAnimator({
				animations,
			}),
			animateFx: (animation: ActorAnimation) =>
				Effect.sync(() => {
					animations.push(animation);
					if (animation.channel === "pose") poseState.active = animation;
				}),
			cancelChannelFx: (_actor: PixiTileActor, channel: AnimationChannel) =>
				Effect.sync(() => {
					if (channel !== "pose" || poseState.active === null) return;
					const canceled = poseState.active;
					poseState.active = null;
					canceled.onCancel?.();
				}),
		} satisfies ActorAnimator;
		Effect.runSync(
			chaseTargetFx({
				actor,
				animator,
				fallbackTarget: {
					layer: new Container(),
					size: 80,
					x: 100,
					y: 0,
				},
				onSettled,
				ownerKey: "test:proximity-cancel",
				readLiveTarget: () => ({
					scale: 1,
					x: 100,
					y: 0,
				}),
				settleWithinTileRatio: 0.5,
				surface: createSurface({
					readLocationPose: () => ({
						layer: new Container(),
						size: 80,
						x: 100,
						y: 0,
					}),
				}),
				targetLocation: secondBoardLocation,
			}),
		);
		const travel = poseState.active;
		if (travel === null) throw new Error("Expected proximity travel.");
		const pose = travel.readPose?.(0.7);
		if (pose === undefined) throw new Error("Expected proximity pose.");
		actor.container.position.set(pose.x, pose.y);
		Effect.runSync(animator.cancelChannelFx(actor, "pose"));
		await Promise.resolve();
		expect(onSettled).not.toHaveBeenCalled();
	});
});
