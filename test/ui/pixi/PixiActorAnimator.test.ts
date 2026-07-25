import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiActorAnimatorFx } from "~/ui/pixi/animation/createPixiActorAnimatorFx";

type TweenProps = Parameters<PixiAnimationDriver["startTweenFx"]>[0];

const createAnimationDriver = () => {
	const tweens: Array<{
		readonly props: TweenProps;
		readonly stop: ReturnType<typeof vi.fn>;
	}> = [];
	const animationDriver = {
		closeFx: Effect.void,
		createSpringFx: () =>
			Effect.succeed({
				closeFx: Effect.void,
				setTargetFx: () => Effect.void,
			} satisfies PixiAnimationSpring),
		startTweenFx: (props) =>
			Effect.sync(() => {
				const stop = vi.fn();
				tweens.push({
					props,
					stop,
				});
				return {
					stopFx: Effect.sync(stop),
				};
			}),
	} satisfies PixiAnimationDriver;
	return {
		animationDriver,
		tweens,
	};
};

const createActor = () =>
	({
		container: {
			alpha: 0.82,
			destroyed: false,
			scale: {
				set(value: number) {
					this.x = value;
				},
				x: 0.75,
			},
			x: 10,
			y: 20,
		},
		item: {
			id: "runtime:actor",
		},
	}) as unknown as PixiTileActor;

describe("Pixi actor animator", () => {
	it("leaves unspecified alpha and scale channels untouched", () => {
		const actor = createActor();
		const { animationDriver, tweens } = createAnimationDriver();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				animationDriver,
			}),
		);

		Effect.runSync(
			animator.animateFx({
				actor,
				durationMs: 300,
				toX: 100,
				toY: 200,
			}),
		);
		tweens[0]?.props.onUpdate(1);

		expect(actor.container.x).toBe(100);
		expect(actor.container.y).toBe(200);
		expect(actor.container.alpha).toBe(0.82);
		expect(actor.container.scale.x).toBe(0.75);
	});

	it("animates explicitly owned alpha and scale channels", () => {
		const actor = createActor();
		const { animationDriver, tweens } = createAnimationDriver();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				animationDriver,
			}),
		);

		Effect.runSync(
			animator.animateFx({
				actor,
				durationMs: 300,
				toAlpha: 1,
				toScale: 1,
				toX: 100,
				toY: 200,
			}),
		);
		tweens[0]?.props.onUpdate(1);

		expect(actor.container.alpha).toBe(1);
		expect(actor.container.scale.x).toBe(1);
	});

	it("stops the replaced key and ignores its stale completion", () => {
		const actor = createActor();
		const { animationDriver, tweens } = createAnimationDriver();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				animationDriver,
			}),
		);
		const firstComplete = vi.fn();
		const secondComplete = vi.fn();

		Effect.runSync(
			animator.animateFx({
				actor,
				animationKey: "shared",
				durationMs: 300,
				onComplete: firstComplete,
				toX: 100,
				toY: 200,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				animationKey: "shared",
				durationMs: 300,
				onComplete: secondComplete,
				toX: 200,
				toY: 300,
			}),
		);

		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		tweens[0]?.props.onComplete?.();
		tweens[1]?.props.onComplete?.();
		tweens[1]?.props.onComplete?.();
		expect(firstComplete).not.toHaveBeenCalled();
		expect(secondComplete).toHaveBeenCalledOnce();
	});

	it("does not mutate a destroyed actor and attempts every close", () => {
		const firstActor = createActor();
		const secondActor = createActor();
		const { animationDriver, tweens } = createAnimationDriver();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				animationDriver,
			}),
		);
		for (const [actor, animationKey] of [
			[
				firstActor,
				"first",
			],
			[
				secondActor,
				"second",
			],
		] as const) {
			Effect.runSync(
				animator.animateFx({
					actor,
					animationKey,
					durationMs: 300,
					toX: 100,
					toY: 200,
				}),
			);
		}
		firstActor.container.destroyed = true;
		tweens[0]?.props.onUpdate(1);
		expect(firstActor.container.x).toBe(10);
		tweens[0]?.stop.mockImplementationOnce(() => {
			throw new Error("stop failed");
		});

		expect(() => Effect.runSync(animator.closeFx)).toThrow();
		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(tweens[1]?.stop).toHaveBeenCalledOnce();
	});
});
