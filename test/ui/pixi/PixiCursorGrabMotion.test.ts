import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiCursorGrabMotionFx } from "~/ui/pixi/drag/createPixiCursorGrabMotionFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

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
	const invalidate = vi.fn();
	const motion = Effect.runSync(
		createPixiCursorGrabMotionFx({
			animationDriver,
			frames: {
				invalidateFx: Effect.sync(invalidate),
			} as unknown as DemandFrameLoop,
		}),
	);
	const actor = {
		container: {
			destroyed: false,
			pivot: {
				set(value: number) {
					this.x = value;
					this.y = value;
				},
				x: 0,
				y: 0,
			},
			x: 10,
			y: 20,
		},
		size: 80,
	} as unknown as PixiTileActor;
	return {
		actor,
		invalidate,
		motion,
		springs,
	};
};

describe("Pixi cursor grab motion", () => {
	it("retargets the pivot to the tile center and preserves the released pose", () => {
		const { actor, invalidate, motion, springs } = createFixture();
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
		expect(springs[0]?.close).toHaveBeenCalledOnce();
		expect(springs[1]?.close).toHaveBeenCalledOnce();
		expect(invalidate).toHaveBeenCalledOnce();
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
