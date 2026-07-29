import { describe, expect, it } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiLiveActorContactPose } from "~/ui/pixi/motion/readPixiLiveActorContactPose";

describe("readPixiLiveActorContactPose", () => {
	it("aligns both physical top-left axes across independent target scales and pivots", () => {
		const target = {
			container: {
				destroyed: false,
				pivot: {
					x: 20,
					y: 30,
				},
				scale: {
					x: 1.25,
					y: 0.75,
				},
				x: 200,
				y: 150,
			},
			size: 80,
		} as PixiTileActor;
		const moving = {
			container: {
				pivot: {
					x: 12,
					y: 18,
				},
			},
			size: 100,
		} as PixiTileActor;

		const pose = readPixiLiveActorContactPose({
			actorId: "runtime:target",
			actors: new Map([
				[
					"runtime:target",
					target,
				],
			]),
			movingActor: moving,
		});

		expect(pose).toEqual({
			scaleX: 1,
			scaleY: 0.6,
			x: 187,
			y: 138.3,
		});
		expect(pose).not.toBeNull();
		if (pose === null) return;
		expect(pose.x - moving.container.pivot.x * pose.scaleX).toBe(
			target.container.x - target.container.pivot.x * target.container.scale.x,
		);
		expect(pose.y - moving.container.pivot.y * pose.scaleY).toBeCloseTo(
			target.container.y - target.container.pivot.y * target.container.scale.y,
		);
	});
});
