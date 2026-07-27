import { Effect } from "effect";
import { Particle, ParticleContainer, Rectangle, Texture } from "pixi.js";

import type { PixiTileActorActivityParticles } from "~/ui/pixi/actor/PixiTileActorActivityParticles";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";

export namespace createPixiTileActorActivityParticlesFx {
	export interface Props {
		readonly actorId: string;
		readonly instanceId: string;
		readonly lightSurface: boolean;
		readonly textures?: Pick<PixiTileActorParticleTextures, "star">;
		readonly tint: number;
	}
}

export const pixiTileActorActivityParticleCount = 12;

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

/** Allocates one fixed, actor-local particle pool; playback never allocates display objects. */
export const createPixiTileActorActivityParticlesFx = Effect.fn(
	"createPixiTileActorActivityParticlesFx",
)(
	({
		actorId,
		instanceId,
		lightSurface,
		textures = {
			star: Texture.EMPTY,
		},
		tint,
	}: createPixiTileActorActivityParticlesFx.Props) =>
		Effect.sync((): PixiTileActorActivityParticles => {
			const particles = Array.from(
				{
					length: pixiTileActorActivityParticleCount,
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
						phaseOffset: index / pixiTileActorActivityParticleCount,
						spreadOffset:
							(((index * 7) % pixiTileActorActivityParticleCount) /
								(pixiTileActorActivityParticleCount - 1)) *
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
