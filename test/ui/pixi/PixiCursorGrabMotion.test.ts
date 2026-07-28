import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type {
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiCursorGrabMotionFx } from "~/ui/pixi/drag/createPixiCursorGrabMotionFx";

type SpringProps = Parameters<PixiAnimationDriver["createSpringFx"]>[0];

const createFixture = (failSpringAt: number | null = null) => {
	const springs: Array<{
		readonly close: ReturnType<typeof vi.fn>;
		readonly props: SpringProps;
		readonly setTarget: ReturnType<typeof vi.fn>;
	}> = [];
	let springCount = 0;
	const animationDriver = {
		closeFx: Effect.void,
		createSpringFx: (props) =>
			Effect.sync(() => {
				springCount += 1;
				if (springCount === failSpringAt) throw new Error("spring failed");
				const close = vi.fn();
				const setTarget = vi.fn();
				springs.push({
					close,
					props,
					setTarget,
				});
				return {
					closeFx: Effect.sync(close),
					setTargetFx: (value) => Effect.sync(() => setTarget(value)),
				} satisfies PixiAnimationSpring;
			}),
		startTweenFx: () =>
			Effect.succeed({
				stopFx: Effect.void,
			}),
	} satisfies PixiAnimationDriver;
	const presentationWrites: PixiActorPresentationWrite[] = [];
	const animator = {
		animateFx: () => Effect.void,
		cancelActorFx: () => Effect.void,
		cancelChannelFx: () => Effect.void,
		cancelFx: () => Effect.void,
		closeFx: Effect.void,
		isChannelActiveFx: () => Effect.succeed(false),
		setFx: (write) =>
			Effect.sync(() => {
				presentationWrites.push(write);
				if (write.channel === "pose") {
					write.actor.container.position.set(write.x, write.y);
					if (write.scale !== undefined) write.actor.container.scale.set(write.scale);
				}
				if (write.channel === "grab-offset") {
					write.actor.container.pivot.set(write.pivotX, write.pivotY);
				}
			}),
	} satisfies PixiActorAnimator;
	const motion = Effect.runSync(
		createPixiCursorGrabMotionFx({
			animationDriver,
			animator,
		}),
	);
	const actor = {
		container: {
			destroyed: false,
			pivot: {
				set(x: number, y = x) {
					this.x = x;
					this.y = y;
				},
				x: 0,
				y: 0,
			},
			position: {
				set(x: number, y: number) {
					actor.container.x = x;
					actor.container.y = y;
				},
			},
			scale: {
				set(value: number) {
					this.x = value;
					this.y = value;
				},
				x: 1,
				y: 1,
			},
			x: 10,
			y: 20,
		},
		size: 80,
	} as unknown as PixiTileActor;
	return {
		actor,
		motion,
		presentationWrites,
		springs,
	};
};

describe("Pixi cursor grab motion", () => {
	it("retargets the pivot to the tile center and preserves the released pose", () => {
		const { actor, motion, presentationWrites, springs } = createFixture();
		Effect.runSync(
			motion.startFx(actor, {
				x: 20,
				y: 30,
			}),
		);

		expect(springs).toHaveLength(2);
		expect(springs[0]?.setTarget).toHaveBeenCalledWith(30);
		expect(springs[1]?.setTarget).toHaveBeenCalledWith(30);
		springs[0]?.props.onUpdate(12);
		springs[1]?.props.onUpdate(18);
		Effect.runSync(motion.finishFx(actor));

		expect(actor.container.x).toBe(-2);
		expect(actor.container.y).toBe(2);
		expect(actor.container.pivot.x).toBe(0);
		expect(actor.container.pivot.y).toBe(0);
		expect(presentationWrites).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "pose",
				scale: 1,
				x: -2,
				y: 2,
			}),
		);
		expect(presentationWrites).toContainEqual({
			actor,
			channel: "grab-offset",
			pivotX: 12,
			pivotY: 0,
		});
		expect(presentationWrites).toContainEqual({
			actor,
			channel: "grab-offset",
			pivotX: 12,
			pivotY: 18,
		});
		expect(presentationWrites.at(-1)).toEqual({
			actor,
			channel: "grab-offset",
			pivotX: 0,
			pivotY: 0,
		});
		expect(springs[0]?.close).toHaveBeenCalledOnce();
		expect(springs[1]?.close).toHaveBeenCalledOnce();
	});

	it("restarts and closes its exact spring pair", () => {
		const { actor, motion, springs } = createFixture();
		Effect.runSync(
			motion.startFx(actor, {
				x: 20,
				y: 30,
			}),
		);
		Effect.runSync(
			motion.startFx(actor, {
				x: 30,
				y: 40,
			}),
		);

		expect(springs).toHaveLength(4);
		expect(springs[0]?.close).toHaveBeenCalledOnce();
		expect(springs[1]?.close).toHaveBeenCalledOnce();
		Effect.runSync(motion.closeFx);
		Effect.runSync(motion.closeFx);
		expect(springs[2]?.close).toHaveBeenCalledOnce();
		expect(springs[3]?.close).toHaveBeenCalledOnce();
		Effect.runSync(
			motion.startFx(actor, {
				x: 40,
				y: 50,
			}),
		);
		expect(springs).toHaveLength(4);
	});

	it("removes a scaled pivot without moving the presented tile", () => {
		const { actor, motion, springs } = createFixture();
		actor.container.scale.set(0.75);
		Effect.runSync(
			motion.startFx(actor, {
				x: 20,
				y: 30,
			}),
		);
		springs[0]?.props.onUpdate(12);
		springs[1]?.props.onUpdate(18);

		Effect.runSync(motion.finishFx(actor));

		expect(actor.container.x).toBe(1);
		expect(actor.container.y).toBe(6.5);
		expect(actor.container.pivot.x).toBe(0);
		expect(actor.container.pivot.y).toBe(0);
	});

	it("rolls back the first axis when the second spring fails", () => {
		const { actor, motion, springs } = createFixture(2);

		expect(() =>
			Effect.runSync(
				motion.startFx(actor, {
					x: 20,
					y: 30,
				}),
			),
		).toThrow();
		expect(springs).toHaveLength(1);
		expect(springs[0]?.close).toHaveBeenCalledOnce();
	});
});
