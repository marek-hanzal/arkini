import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiActorAnimatorFx } from "~/ui/pixi/animation/createPixiActorAnimatorFx";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

type TweenProps = Parameters<PixiAnimationDriver["startTweenFx"]>[0];

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
			} satisfies PixiAnimationSpring),
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
						props.onComplete?.();
					},
					props,
					stop,
					update: (progress) => {
						if (active) props.onUpdate(progress);
					},
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

const createFrames = () => {
	const invalidate = vi.fn();
	return {
		frames: {
			closeFx: Effect.void,
			invalidateFx: Effect.sync(invalidate),
			reportCriticalFailure: vi.fn(),
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
		crowdLayer: {
			alpha: 1,
		},
		instanceId,
		item: {
			id,
		},
		runningGlow: {
			alpha: 0.28,
			visible: true,
		},
	}) as unknown as PixiTileActor;

const createAnimator = () => {
	const { animationDriver, tweens } = createAnimationDriver();
	const { frames, invalidate } = createFrames();
	return {
		animator: Effect.runSync(
			createPixiActorAnimatorFx({
				animationDriver,
				frames,
			}),
		),
		invalidate,
		tweens,
	};
};

describe("Pixi actor animator", () => {
	it("keeps pose, lifecycle, crowd, and glow channels physically isolated", () => {
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
		expect(actor.crowdLayer.alpha).toBe(1);
		expect(actor.runningGlow.alpha).toBe(0.28);

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 300,
				ownerKey: "entry:actor",
				toAlpha: 1,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: "running:actor",
				toCrowdAlpha: 0.82,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "glow-opacity",
				durationMs: 640,
				ownerKey: "glow:actor",
				toRunningGlowAlpha: 0.62,
			}),
		);
		tweens[1]?.update(0.5);
		tweens[2]?.update(0.5);
		tweens[3]?.update(0.5);

		expect(actor.container.alpha).toBeCloseTo(0.91);
		expect(actor.crowdLayer.alpha).toBeCloseTo(0.91);
		expect(actor.runningGlow.alpha).toBeCloseTo(0.45);
		expect(actor.container.x).toBe(100);
		expect(actor.container.y).toBe(200);
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
				onCancel: canceled,
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

	it("reverses one channel from its live value even when the successor has another owner key", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: "running:start",
				toCrowdAlpha: 0.82,
			}),
		);
		tweens[0]?.update(0.5);
		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: "running:stop",
				toCrowdAlpha: 1,
			}),
		);
		tweens[1]?.update(0.5);

		expect(tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(actor.crowdLayer.alpha).toBeCloseTo(0.955);
	});

	it("settles cancellation separately from natural completion", () => {
		const actor = createActor();
		const { animator, tweens } = createAnimator();
		const canceled = vi.fn();
		const completed = vi.fn();

		Effect.runSync(
			animator.animateFx({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 220,
				onCancel: canceled,
				onComplete: completed,
				toAlpha: 0,
			}),
		);
		tweens[0]?.complete();

		expect(completed).toHaveBeenCalledOnce();
		expect(canceled).not.toHaveBeenCalled();
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
				ownerKey: readPixiActorAlphaAnimationKey(exiting),
				toAlpha: 0,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: replacement,
				channel: "lifecycle-opacity",
				durationMs: 520,
				ownerKey: readPixiActorAlphaAnimationKey(replacement),
				toAlpha: 1,
			}),
		);

		expect(readPixiActorAlphaAnimationKey(exiting)).not.toBe(
			readPixiActorAlphaAnimationKey(replacement),
		);
		expect(tweens[0]?.stop).not.toHaveBeenCalled();
		expect(tweens[1]?.stop).not.toHaveBeenCalled();
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
				onComplete: staleComplete,
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
				onComplete: survivingComplete,
				ownerKey: "second-owner",
				toX: 200,
				toY: 300,
			}),
		);
		Effect.runSync(
			animator.animateFx({
				actor: secondActor,
				channel: "glow-opacity",
				durationMs: 300,
				ownerKey: "second-actor-glow",
				toRunningGlowAlpha: 0.62,
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
