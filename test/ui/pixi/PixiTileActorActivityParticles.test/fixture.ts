import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimation,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";

export const createActivityParticleActor = () =>
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
			particles: Array.from({ length: 4 }, (_, index) => ({
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
			})),
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

export const createActivityParticleAnimator = () => {
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
