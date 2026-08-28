import { Effect } from "effect";
import { Particle, ParticleContainer, Rectangle, Texture } from "pixi.js";

import type { ActivityParticles } from "~/ui/pixi/actor/ActivityParticles";
import type { ParticleTextures } from "~/ui/pixi/actor/ParticleTextures";

export namespace createActivityParticlesFx {
	export interface Props {
		readonly actorId: string;
		readonly instanceId: string;
		readonly lightSurface: boolean;
		readonly textures?: Pick<ParticleTextures, "star">;
		readonly tint: number;
	}
}

const activityParticleCount = 12;

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

/** Allocates one fixed, actor-local particle pool; playback never allocates display objects. */
export const createActivityParticlesFx = Effect.fn("createActivityParticlesFx")(
	({
		actorId,
		instanceId,
		lightSurface,
		textures = {
			star: Texture.EMPTY,
		},
		tint,
	}: createActivityParticlesFx.Props) =>
		Effect.sync((): ActivityParticles => {
			const particles = Array.from(
				{
					length: activityParticleCount,
				},
				(_, index) => {
					const particle = new Particle({
						alpha: 0,
						anchorX: 0.5,
						anchorY: 0.5,
						texture: textures.star,
						tint,
					});
					return {
						alphaScale: 0.84 + ((index * 37) % 17) / 100,
						particle,
						phaseOffset: index / activityParticleCount,
						spreadOffset:
							(((index * 7) % activityParticleCount) / (activityParticleCount - 1)) *
								2 -
							1,
						speedCycles: 1 + ((index * 5) % 3),
						waveOffset: index * goldenAngle,
					};
				},
			);
			const container = new ParticleContainer({
				boundsArea: new Rectangle(0, 0, 1, 1),
				dynamicProperties: {
					color: true,
					position: true,
					rotation: false,
					uvs: false,
					vertex: false,
				},
				eventMode: "none",
				label: `TileActorActivityParticles:${actorId}:${instanceId}`,
				particles: particles.map(({ particle }) => particle),
				texture: textures.star,
			});
			container.blendMode = "add";
			container.visible = false;

			return {
				centerX: 0,
				container,
				feedbackPhase: null,
				lastProgress: 0,
				lightSurface,
				particles,
				startY: 0,
				topHalfWidth: 0,
				topY: 0,
				workingTint: tint,
			};
		}),
);
