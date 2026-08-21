import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimation,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { pixiTileActorFeedbackParticlesDurationMs } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { burstPixiTileActorAckParticlesFx } from "~/ui/pixi/animation/burstPixiTileActorAckParticlesFx";
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/burstPixiTileActorFeedbackParticlesFx";
import { startPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/startPixiTileActorActivityParticlesFx";
import { stopPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/stopPixiTileActorActivityParticlesFx";

const createActor = () =>
	({
		activityParticles: {
			centerX: 40,
			container: {
				blendMode: "add",
				visible: false,
			},
			feedbackPhase: null,
			lastProgress: 0,
			lightSurface: false,
			particles: Array.from(
				{
					length: 4,
				},
				(_, index) => ({
					alphaScale: 1,
					particle: {
						alpha: 0,
						tint: 0,
						x: 0,
						y: 0,
					},
					phaseOffset: index / 4,
					spreadOffset: -1 + (index / 3) * 2,
					speedCycles: index + 1,
					waveOffset: index * 1.7,
				}),
			),
			startY: 68,
			topHalfWidth: 30,
			topY: -18,
			workingTint: 0xf05bb8,
		},
		container: {
			destroyed: false,
		},
		instanceId: "pixi-tile:producer",
		item: {
			activityEffect: true,
			id: "runtime:producer",
		},
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
			isChannelActiveFx: () => Effect.succeed(false),
			setFx: (write) =>
				Effect.sync(() => {
					writes.push(write);
					if (write.channel !== "activity-particles") return;
					if (write.reset) {
						for (const { particle } of write.actor.activityParticles.particles) {
							particle.alpha = 0;
						}
					}
					write.actor.activityParticles.container.visible = write.visible;
				}),
		} satisfies PixiActorAnimator,
		cancellations,
		writes,
	};
};

const readColorDistance = (left: number, right: number) =>
	Math.abs(((left >> 16) & 0xff) - ((right >> 16) & 0xff)) +
	Math.abs(((left >> 8) & 0xff) - ((right >> 8) & 0xff)) +
	Math.abs((left & 0xff) - (right & 0xff));

describe("Pixi tile actor activity particles", () => {
	it("runs one linear repeated plume tween without allocating or chaining another pool", () => {
		const actor = createActor();
		const particles = actor.activityParticles.particles.map(({ particle }) => particle);
		const { animations, animator, cancellations, writes } = createAnimator();

		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
		]);
		expect(writes).toEqual([
			{
				actor,
				channel: "activity-particles",
				reset: true,
				visible: true,
			},
		]);
		expect(animations[0]).toMatchObject({
			actor,
			channel: "activity-particles",
			curve: {
				kind: "linear",
			},
			durationMs: 1_760,
			ownerKey: "activity-particles:pixi-tile:producer",
			repeat: Number.POSITIVE_INFINITY,
		});
		expect(animations[0]?.onComplete).toBeUndefined();

		if (animations[0]?.channel === "activity-particles") animations[0].render(0.8);
		expect(particles.some(({ alpha }) => alpha > 0)).toBe(true);
		expect(particles.some(({ y }) => y < actor.activityParticles.startY)).toBe(true);

		expect(animations).toHaveLength(1);
		expect(actor.activityParticles.particles.map(({ particle }) => particle)).toEqual(
			particles,
		);
	});

	it("widens from one bottom apex and stays visually continuous across the loop boundary", () => {
		const actor = createActor();
		const { animations, animator } = createAnimator();
		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);
		const playback = animations[0];
		if (playback?.channel !== "activity-particles") {
			throw new Error("Expected activity-particle playback.");
		}
		const apexParticle = actor.activityParticles.particles[0]?.particle;
		if (apexParticle === undefined) throw new Error("Expected apex particle.");

		playback.render(0);
		expect(apexParticle.x).toBe(actor.activityParticles.centerX);
		expect(apexParticle.y).toBe(actor.activityParticles.startY);
		playback.render(0.5);
		const middleDistance = Math.abs(apexParticle.x - actor.activityParticles.centerX);
		expect(middleDistance).toBeGreaterThan(0);
		expect(apexParticle.y).toBeLessThan(actor.activityParticles.startY);
		playback.render(0.9);
		expect(Math.abs(apexParticle.x - actor.activityParticles.centerX)).toBeGreaterThan(
			middleDistance,
		);

		playback.render(0.9999);
		const beforeWrap = actor.activityParticles.particles.map(({ particle }) => ({
			alpha: particle.alpha,
			tint: particle.tint,
			x: particle.x,
			y: particle.y,
		}));
		playback.render(0);
		for (const [index, { particle }] of actor.activityParticles.particles.entries()) {
			const before = beforeWrap[index];
			if (before === undefined) throw new Error("Expected particle snapshot.");
			expect(particle.alpha).toBeCloseTo(before.alpha, 2);
			if (Math.max(particle.alpha, before.alpha) < 0.05) continue;
			expect(readColorDistance(particle.tint, before.tint)).toBeLessThanOrEqual(3);
			expect(particle.x).toBeCloseTo(before.x, 1);
			expect(particle.y).toBeCloseTo(before.y, 1);
		}
	});

	it("drains the live distribution before hiding a stopped actor", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();
		actor.activityParticles.container.visible = true;
		actor.activityParticles.lastProgress = 0.42;
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			stopPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("draining");
		expect(animations[0]).toMatchObject({
			channel: "activity-particles",
			durationMs: 460,
			ownerKey: "activity-particles:pixi-tile:producer",
		});
		animations[0]?.onComplete?.();
		expect(actor.activityParticles.container.visible).toBe(false);
		expect(actor.activityParticles.feedbackPhase).toBeNull();
	});

	it("does not expose a completion callback that could schedule a stale successor", () => {
		const actor = createActor();
		const { animations, animator } = createAnimator();
		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		expect(animations[0]?.onComplete).toBeUndefined();
		expect(animations).toHaveLength(1);
	});

	it("bursts a neutral actor in semantic color and hides the shared pool", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);

		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(animations[0]).toMatchObject({
			channel: "activity-particles",
			durationMs: pixiTileActorFeedbackParticlesDurationMs,
			ownerKey: "activity-particles:pixi-tile:producer",
		});
		if (animations[0]?.channel === "activity-particles") animations[0].render(0.62);
		const visibleTints = actor.activityParticles.particles
			.filter(({ particle }) => particle.alpha > 0)
			.map(({ particle }) => particle.tint);
		expect(new Set(visibleTints).size).toBeGreaterThan(1);
		for (const tint of visibleTints) {
			const red = (tint >> 16) & 0xff;
			const green = (tint >> 8) & 0xff;
			const blue = tint & 0xff;
			expect(green).toBeGreaterThan(blue);
			expect(blue).toBeGreaterThan(red);
		}

		animations[0]?.onComplete?.();
		expect(actor.activityParticles.container.visible).toBe(false);
		expect(actor.activityParticles.feedbackPhase).toBeNull();
	});

	it("crossfades one ACK pool into the running plume without an overlap or reset", () => {
		const actor = createActor();
		const { animations, animator, cancellations, writes } = createAnimator();
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			burstPixiTileActorFeedbackParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		const burst = animations[0];
		if (burst?.channel !== "activity-particles") {
			throw new Error("Expected feedback particle burst.");
		}
		burst.render(0.7);
		const ackFrame = actor.activityParticles.particles.map(({ particle }) => ({
			alpha: particle.alpha,
			tint: particle.tint,
			x: particle.x,
			y: particle.y,
		}));
		actor.item = {
			...actor.item,
			activityEffect: true,
		};
		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);
		expect(animations).toHaveLength(1);
		burst.render(0.7);
		for (const [index, { particle }] of actor.activityParticles.particles.entries()) {
			const ack = ackFrame[index];
			if (ack === undefined) throw new Error("Expected ACK particle snapshot.");
			expect(particle.alpha).toBeCloseTo(ack.alpha, 6);
			expect(particle.tint).toBe(ack.tint);
			expect(particle.x).toBeCloseTo(ack.x, 6);
			expect(particle.y).toBeCloseTo(ack.y, 6);
		}
		burst.render(1);
		const handoffFrame = actor.activityParticles.particles.map(({ particle }) => ({
			alpha: particle.alpha,
			tint: particle.tint,
			x: particle.x,
			y: particle.y,
		}));
		animations[0]?.onComplete?.();

		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
			"activity-particles:pixi-tile:producer",
		]);
		expect(animations[1]).toMatchObject({
			channel: "activity-particles",
			curve: {
				kind: "linear",
			},
			durationMs: 1_760,
			ownerKey: "activity-particles:pixi-tile:producer",
			repeat: Number.POSITIVE_INFINITY,
		});
		const running = animations[1];
		if (running?.channel !== "activity-particles") {
			throw new Error("Expected running particle playback.");
		}
		running.render(0);
		for (const [index, { particle }] of actor.activityParticles.particles.entries()) {
			const handoff = handoffFrame[index];
			if (handoff === undefined) throw new Error("Expected handoff particle snapshot.");
			expect(particle.alpha).toBeCloseTo(handoff.alpha, 6);
			expect(particle.tint).toBe(handoff.tint);
			expect(particle.x).toBeCloseTo(handoff.x, 6);
			expect(particle.y).toBeCloseTo(handoff.y, 6);
		}
		expect(writes.at(-1)).toEqual({
			actor,
			channel: "activity-particles",
			reset: false,
			visible: true,
		});
		expect(actor.activityParticles.feedbackPhase).toBeNull();
	});

	it("does not let a running projection supersede a live ACK burst", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();
		actor.item = {
			...actor.item,
			activityEffect: false,
		};
		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		actor.item = {
			...actor.item,
			activityEffect: true,
		};
		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(animations).toHaveLength(1);
		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
		]);

		animations[0]?.onComplete?.();
		expect(animations[1]).toMatchObject({
			channel: "activity-particles",
			durationMs: 1_760,
			repeat: Number.POSITIVE_INFINITY,
		});
	});

	it("keeps ACK feedback alive when an instant job stops before the burst completes", () => {
		const actor = createActor();
		const { animations, animator, cancellations } = createAnimator();

		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		actor.item = {
			...actor.item,
			activityEffect: false,
		};
		Effect.runSync(
			stopPixiTileActorActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(animations).toHaveLength(1);
		expect(cancellations).toEqual([
			"activity-particles:pixi-tile:producer",
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		animations[0]?.onComplete?.();
		expect(actor.activityParticles.container.visible).toBe(false);
	});
});
