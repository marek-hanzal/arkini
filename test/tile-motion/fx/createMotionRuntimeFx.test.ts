// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

import {
	createSurface,
	secondBoardLocation,
	createActor,
	createRecordingAnimator,
	type PixiTileActor,
	type ActorAnimation,
	type AnimationChannel,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion cancellation", () => {
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
					canceled.onCancelFn?.();
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
				onSettledFn: onSettled,
				ownerKey: "test:proximity-cancel",
				readLiveTargetFn: () => ({
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
		const pose = travel.readPoseFn?.(0.7);
		if (pose === undefined) throw new Error("Expected proximity pose.");
		actor.container.position.set(pose.x, pose.y);
		Effect.runSync(animator.cancelChannelFx(actor, "pose"));
		await Promise.resolve();
		expect(onSettled).not.toHaveBeenCalled();
	});
});
