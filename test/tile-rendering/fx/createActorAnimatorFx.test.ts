import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { AnimationDriver, AnimationSpring } from "~/tile-rendering/service/AnimationDriver";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

type TweenProps = Parameters<AnimationDriver["startTweenFx"]>[0];

interface TestTween {
	readonly complete: () => void;
	readonly props: TweenProps;
	readonly stop: ReturnType<typeof vi.fn>;
	readonly update: (progress: number) => void;
}

const createAnimationDriver = () => {
	const tweens: TestTween[] = [];
	const animationDriver = {
		closeFx: Effect.void,
		createSpringFx: () =>
			Effect.succeed({
				closeFx: Effect.void,
				setTargetFx: () => Effect.void,
			} satisfies AnimationSpring),
		startTweenFx: (props) =>
			Effect.sync(() => {
				let active = true;
				const stop = vi.fn(() => {
					active = false;
				});
				tweens.push({
					complete: () => {
						if (!active) return;
						active = false;
						props.onCompleteFn?.();
					},
					props,
					stop,
					update: (progress) => {
						if (active) props.onUpdateFn(progress);
					},
				});
				return {
					stopFx: Effect.sync(stop),
				};
			}),
	} satisfies AnimationDriver;
	return {
		animationDriver,
		tweens,
	};
};

const createFrames = () => {
	const invalidate = vi.fn();
	return {
		frames: {
			addBeforeRenderListenerFx: () => Effect.succeed(() => {}),
			closeFx: Effect.void,
			invalidateFx: Effect.sync(invalidate),
			scheduleAfterRenderFx: (work) =>
				Effect.sync(() => {
					work();
					return () => {};
				}),
			scheduleFx: (work) =>
				Effect.sync(() => {
					work();
					return () => {};
				}),
			reportCriticalFailureFn: vi.fn(),
		} satisfies DemandFrameLoop,
		invalidate,
	};
};

const createActor = (id = "runtime:actor", instanceId = `instance:${id}`) =>
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
		visualLayer: new Container(),
		lifecycleLayer: {
			scale: {
				set(value: number) {
					this.x = value;
				},
				x: 1,
			},
		},
		instanceId,
		item: {
			id,
		},
	}) as unknown as PixiTileActor;

const createAnimator = () => {
	const { animationDriver, tweens } = createAnimationDriver();
	const { frames, invalidate } = createFrames();
	return {
		animator: Effect.runSync(
			createActorAnimatorFx({
				animationDriver,
				frames,
			}),
		),
		invalidate,
		tweens,
	};
};

describe("actor animator", () => {
	it("keeps pose, lifecycle, and crowd channels physically isolated", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				durationMs: 300,
				ownerKey: "motion:actor",
				toScale: 1,
				toX: 100,
				toY: 200,
			}),
		);
		tweens[0]?.update(1);

		expect(actor.container).toMatchObject({
			alpha: 0.82,
			x: 100,
			y: 200,
		});
		expect(actor.container.scale.x).toBe(1);

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 300,
				ownerKey: "entry:actor",
				toAlpha: 1,
			}),
		);
		tweens[1]?.update(0.5);
		expect(actor.container.alpha).toBeCloseTo(0.91);
		expect(actor.container.x).toBe(100);
		expect(actor.container.y).toBe(200);
	});

	it("reverses drop feedback from live progress without interrupting other visual channels", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();

		for (const animation of [
			{
				channel: "pose",
				toX: 100,
				toY: 200,
				toScale: 1,
			},
			{
				channel: "lifecycle-scale",
				toScale: 0.6,
			},
			{
				channel: "lifecycle-opacity",
				toAlpha: 0.4,
			},
			{
				channel: "drop-target",
				toFactor: 0.8,
			},
		] as const) {
			Effect.runSync(
				animator.animateFx({
					actor,
					durationMs: 180,
					...animation,
				}),
			);
		}
		for (const tween of tweens) tween.update(0.5);
		expect(actor.visualLayer.scale.x).toBeCloseTo(0.9);
		expect(actor.visualLayer.alpha).toBeCloseTo(0.9);

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "drop-target",
				durationMs: 180,
				toFactor: 1.2,
			}),
		);
		for (const tween of tweens.slice(0, 3)) {
			expect(tween.stop).not.toHaveBeenCalled();
			tween.update(1);
		}
		expect(tweens[3]?.stop).toHaveBeenCalledOnce();
		tweens[3]?.update(1);
		tweens[4]?.update(0.5);
		expect(actor.visualLayer.scale.x).toBeCloseTo(1.05);
		expect(actor.visualLayer.alpha).toBeCloseTo(0.95);
		expect(actor.container.x).toBe(100);
		expect(actor.container.y).toBe(200);
		expect(actor.container.scale.x).toBe(1);
		expect(actor.container.alpha).toBeCloseTo(0.4);
		expect(actor.lifecycleLayer.scale.x).toBeCloseTo(0.6);

		tweens[4]?.update(1);
		expect(actor.visualLayer.scale.x).toBe(1.2);
		expect(actor.visualLayer.alpha).toBe(1);
		Effect.runSync(
			animator.setFx({
				actor,
				channel: "drop-target",
				factor: 1,
			}),
		);
		expect(tweens[4]?.stop).toHaveBeenCalledOnce();
		expect(actor.visualLayer.scale.x).toBe(1);
		expect(actor.visualLayer.alpha).toBe(1);
	});

	it("keeps lifecycle scale independent from canonical pose scale", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				durationMs: 300,
				toScale: 1,
				toX: 100,
				toY: 200,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-scale",
				durationMs: 300,
				toScale: 0.8,
			}),
		);
		tweens[0]?.update(0.5);
		tweens[1]?.update(0.5);

		expect(actor.container.scale.x).toBeCloseTo(0.875);
		expect(actor.lifecycleLayer.scale.x).toBeCloseTo(0.9);
		expect(actor.container.x).toBeCloseTo(55);
		expect(actor.container.y).toBeCloseTo(110);
	});

	it("supersedes different owners on one actor channel while another channel keeps producing frames", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();
		const canceled = vi.fn();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 520,
				onCancelFn: canceled,
				ownerKey: "spawn-entry",
				toAlpha: 1,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				durationMs: 800,
				ownerKey: "spawn-travel",
				toX: 110,
				toY: 220,
			}),
		);
		tweens[0]?.update(0.5);
		tweens[1]?.update(0.25);
		expect(actor.container.alpha).toBeCloseTo(0.91);
		expect(actor.container.x).toBe(35);
		expect(actor.container.y).toBe(70);

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 220,
				ownerKey: "exit",
				toAlpha: 0,
			}),
		);

		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(tweens[1]?.stop).not.toHaveBeenCalled();
		expect(canceled).toHaveBeenCalledOnce();

		// A stopped driver's stale frame is ignored, the independently owned pose keeps advancing,
		// and the successor opacity starts from the exact live interrupted value.
		tweens[0]?.update(1);
		tweens[1]?.update(0.75);
		tweens[2]?.update(0.5);

		expect(actor.container.alpha).toBeCloseTo(0.455);
		expect(actor.container.x).toBe(85);
		expect(actor.container.y).toBe(170);
	});

	it("settles cancellation separately from natural completion", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();
		const canceled = vi.fn();
		const completed = vi.fn();

		expect(Effect.runSync(animator.isChannelActiveFx(actor, "lifecycle-opacity"))).toBe(false);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 220,
				onCancelFn: canceled,
				onCompleteFn: completed,
				toAlpha: 0,
			}),
		);
		expect(Effect.runSync(animator.isChannelActiveFx(actor, "lifecycle-opacity"))).toBe(true);
		tweens[0]?.complete();

		expect(completed).toHaveBeenCalledOnce();
		expect(canceled).not.toHaveBeenCalled();
		expect(Effect.runSync(animator.isChannelActiveFx(actor, "lifecycle-opacity"))).toBe(false);
		Effect.runSync(animator.cancelActorFx(actor));
		expect(canceled).not.toHaveBeenCalled();
	});

	it("setFx cancels only its physical channel, applies the write, and invalidates one frame", () => {
		const actor = createActor();
		const { animator, invalidate, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 520,
				ownerKey: "entry",
				toAlpha: 1,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				durationMs: 520,
				ownerKey: "travel",
				toX: 100,
				toY: 200,
			}),
		);

		Effect.runSync(
			animator.setFx({
				actor,
				alpha: 0.25,
				channel: "lifecycle-opacity",
			}),
		);

		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(tweens[1]?.stop).not.toHaveBeenCalled();
		expect(actor.container.alpha).toBe(0.25);
		expect(invalidate).toHaveBeenCalledOnce();
	});

	it("cancelActorFx stops every channel owned by the exact actor only", () => {
		const firstActor = createActor("runtime:first");
		const secondActor = createActor("runtime:second");
		const { animator, tweens } = createAnimator();

		for (const [actor, channel, ownerKey] of [
			[
				firstActor,
				"pose",
				"first:pose",
			],
			[
				firstActor,
				"lifecycle-opacity",
				"first:alpha",
			],
			[
				secondActor,
				"pose",
				"second:pose",
			],
		] as const) {
			Effect.runSync(
				channel === "pose"
					? animator.animateFx({
							actor,
							channel,
							durationMs: 300,
							ownerKey,
							toX: 100,
							toY: 200,
						})
					: animator.animateFx({
							actor,
							channel,
							durationMs: 300,
							ownerKey,
							toAlpha: 0,
						}),
			);
		}

		Effect.runSync(animator.cancelActorFx(firstActor));

		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(tweens[1]?.stop).toHaveBeenCalledOnce();
		expect(tweens[2]?.stop).not.toHaveBeenCalled();
	});

	it("does not let a replacement instance cancel the exiting instance with the same item id", () => {
		const exiting = createActor("runtime:same", "instance:exiting");
		const replacement = createActor("runtime:same", "instance:replacement");
		const { animator, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor: exiting,
				channel: "lifecycle-opacity",
				durationMs: 220,
				ownerKey: `actor-alpha:${exiting.instanceId}`,
				toAlpha: 0,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: replacement,
				channel: "lifecycle-opacity",
				durationMs: 520,
				ownerKey: `actor-alpha:${replacement.instanceId}`,
				toAlpha: 1,
			}),
		);

		expect(`actor-alpha:${exiting.instanceId}`).not.toBe(
			`actor-alpha:${replacement.instanceId}`,
		);
		expect(tweens[0]?.stop).not.toHaveBeenCalled();
		expect(tweens[1]?.stop).not.toHaveBeenCalled();
	});

	it("does not read or animate an actor destroyed by the superseded animation cancellation", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				durationMs: 300,
				onCancelFn: () => {
					actor.container.destroyed = true;
					Object.defineProperty(actor.container, "x", {
						get: () => {
							throw new Error("destroyed transform was read");
						},
					});
				},
				ownerKey: "delivery:arrival",
				toX: 100,
				toY: 200,
			}),
		);

		expect(() =>
			Effect.runSync(
				animator.animateFx({
					actor,
					channel: "pose",
					durationMs: 300,
					ownerKey: "delivery:return",
					toX: 10,
					toY: 20,
				}),
			),
		).not.toThrow();
		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(tweens).toHaveLength(1);
	});

	it("ignores stale completion and attempts every active channel during close", () => {
		const firstActor = createActor("runtime:first");
		const secondActor = createActor("runtime:second");
		const thirdActor = createActor("runtime:third");
		const { animator, tweens } = createAnimator();
		const staleComplete = vi.fn();
		const survivingComplete = vi.fn();

		Effect.runSync(
			animator.animateFx({
				actor: firstActor,
				channel: "pose",
				durationMs: 300,
				onCompleteFn: staleComplete,
				ownerKey: "first-owner",
				toX: 100,
				toY: 200,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: firstActor,
				channel: "pose",
				durationMs: 300,
				onCompleteFn: survivingComplete,
				ownerKey: "second-owner",
				toX: 200,
				toY: 300,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: secondActor,
				channel: "lifecycle-opacity",
				durationMs: 300,
				ownerKey: "second-actor-opacity",
				toAlpha: 0.6,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: thirdActor,
				channel: "pose",
				durationMs: 300,
				ownerKey: "third-actor-pose",
				toX: 50,
				toY: 60,
			}),
		);

		tweens[0]?.complete();
		tweens[1]?.complete();
		expect(staleComplete).not.toHaveBeenCalled();
		expect(survivingComplete).toHaveBeenCalledOnce();

		tweens[2]?.stop.mockImplementationOnce(() => {
			throw new Error("stop failed");
		});
		expect(() => Effect.runSync(animator.closeFx)).toThrow();
		expect(tweens[2]?.stop).toHaveBeenCalledOnce();
		expect(tweens[3]?.stop).toHaveBeenCalledOnce();
	});
});
