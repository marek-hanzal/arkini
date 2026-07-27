import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimation,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import {
	flashPixiTileActorAckGlowFx,
	flashPixiTileActorFeedbackGlowFx,
	startPixiTileActorRunningGlowFx,
	stopPixiTileActorRunningGlowFx,
} from "~/ui/pixi/animation/runPixiTileActorRunningGlowFx";

const createActor = () =>
	({
		container: {
			destroyed: false,
		},
		feedbackGlowPhase: null,
		instanceId: "pixi-tile:producer",
		item: {
			id: "runtime:producer",
			runningGlow: true,
		},
		runningGlow: {
			alpha: 0,
			tint: 0xf05bb8,
			visible: false,
		},
		workingGlowTint: 0xf05bb8,
	}) as unknown as PixiTileActor;

const createAnimator = () => {
	const animations: PixiActorAnimation[] = [];
	const cancellations: string[] = [];
	const writes: PixiActorPresentationWrite[] = [];
	return {
		animations,
		animator: {
			animateFx: (animation) =>
				Effect.sync(() => {
					animations.push(animation);
				}),
			cancelActorFx: () => Effect.void,
			cancelChannelFx: () => Effect.void,
			cancelFx: (animationKey) =>
				Effect.sync(() => {
					cancellations.push(animationKey);
				}),
			closeFx: Effect.void,
			setFx: (write) =>
				Effect.sync(() => {
					writes.push(write);
					if (write.channel !== "glow-opacity") return;
					if (write.alpha !== undefined) write.actor.runningGlow.alpha = write.alpha;
					if (write.visible !== undefined)
						write.actor.runningGlow.visible = write.visible;
				}),
		} satisfies PixiActorAnimator,
		cancellations,
		writes,
	};
};

describe("Pixi tile actor running glow", () => {
	it("fades in before looping one slow glow-only pulse", () => {
		const actor = createActor();
		const { animations, animator, cancellations, writes } = createAnimator();

		Effect.runSync(
			startPixiTileActorRunningGlowFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"running-glow:pixi-tile:producer",
		]);
		expect(actor.runningGlow).toMatchObject({
			alpha: 0,
			visible: true,
		});
		expect(writes).toEqual([
			{
				actor,
				channel: "glow-opacity",
				visible: true,
			},
		]);
		expect(animations[0]).toMatchObject({
			actor,
			channel: "glow-opacity",
			durationMs: 640,
			ownerKey: "running-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0.62,
		});

		animations[0]?.onComplete?.();
		expect(animations[1]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 2_400,
			ownerKey: "running-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0.28,
		});
	});

	it("cancels and fades out the exact actor glow before hiding it", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();
		actor.runningGlow.alpha = 0.31;
		actor.runningGlow.visible = true;
		actor.item = {
			...actor.item,
			runningGlow: false,
		};

		Effect.runSync(
			stopPixiTileActorRunningGlowFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"running-glow:pixi-tile:producer",
		]);
		expect(animations[0]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 640,
			ownerKey: "running-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0,
		});
		expect(actor.runningGlow.visible).toBe(true);
		animations[0]?.onComplete?.();
		expect(actor.runningGlow.visible).toBe(false);
	});

	it("does not schedule a stale successor after the actor stops", () => {
		const actor = createActor();
		const { animations, animator } = createAnimator();
		Effect.runSync(
			startPixiTileActorRunningGlowFx({
				actor,
				animator,
			}),
		);
		const completion = vi.fn(animations[0]?.onComplete);
		actor.item = {
			...actor.item,
			runningGlow: false,
		};

		completion();

		expect(completion).toHaveBeenCalledOnce();
		expect(animations).toHaveLength(1);
	});

	it("flashes a neutral actor and hides the shared glow after fading out", () => {
		const actor = createActor();
		const { animations, animator, cancellations, writes } = createAnimator();
		actor.item = {
			...actor.item,
			runningGlow: false,
		};

		Effect.runSync(
			flashPixiTileActorFeedbackGlowFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"feedback-glow:pixi-tile:producer",
		]);
		expect(writes[0]).toEqual({
			actor,
			channel: "glow-opacity",
			visible: true,
		});
		expect(animations[0]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 110,
			ownerKey: "feedback-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0.82,
		});

		animations[0]?.onComplete?.();
		expect(animations[1]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 520,
			ownerKey: "feedback-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0,
		});
		animations[1]?.onComplete?.();
		expect(actor.runningGlow.visible).toBe(false);
		expect(actor.feedbackGlowPhase).toBeNull();
	});

	it("recolors one visible feedback glow and hands it directly to the working pulse", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();

		Effect.runSync(
			flashPixiTileActorAckGlowFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		expect(actor.runningGlow.tint).toBe(0x57d7b2);
		animations[0]?.onComplete?.();

		expect(cancellations).toEqual([
			"feedback-glow:pixi-tile:producer",
			"running-glow:pixi-tile:producer",
		]);
		expect(animations[1]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 2_400,
			ownerKey: "running-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0.28,
		});
		expect(actor.runningGlow.tint).toBe(0xf05bb8);
		expect(actor.feedbackGlowPhase).toBeNull();
	});

	it("hands a falling ACK directly to working as soon as canonical running arrives", () => {
		const actor = createActor();
		const { animations, animator } = createAnimator();
		actor.item = {
			...actor.item,
			runningGlow: false,
		};

		Effect.runSync(
			flashPixiTileActorAckGlowFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		animations[0]?.onComplete?.();
		expect(actor.feedbackGlowPhase).toBe("falling");
		actor.runningGlow.alpha = 0.46;
		actor.item = {
			...actor.item,
			runningGlow: true,
		};
		Effect.runSync(
			startPixiTileActorRunningGlowFx({
				actor,
				animator,
			}),
		);

		expect(animations[2]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 2_400,
			ownerKey: "running-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0.28,
		});
		expect(actor.runningGlow.tint).toBe(0xf05bb8);
		expect(actor.feedbackGlowPhase).toBeNull();
	});

	it("keeps ACK feedback alive when an instant job stops before its rise completes", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();

		Effect.runSync(
			flashPixiTileActorAckGlowFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		actor.item = {
			...actor.item,
			runningGlow: false,
		};
		Effect.runSync(
			stopPixiTileActorRunningGlowFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"feedback-glow:pixi-tile:producer",
		]);
		expect(animations).toHaveLength(1);
		expect(actor.feedbackGlowPhase).toBe("rising");
		expect(actor.runningGlow.tint).toBe(0x57d7b2);

		animations[0]?.onComplete?.();
		expect(animations[1]).toMatchObject({
			channel: "glow-opacity",
			durationMs: 520,
			ownerKey: "feedback-glow:pixi-tile:producer",
			toRunningGlowAlpha: 0,
		});
	});
});
