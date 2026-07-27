import { Effect } from "effect";
import { Particle, ParticleContainer, Rectangle, Texture } from "pixi.js";

import type { PixiTileActorActivityParticles } from "~/ui/pixi/actor/PixiTileActorActivityParticles";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";

export namespace createPixiTileActorActivityParticlesFx {
	export interface Props {
		readonly actorId: string;
		readonly instanceId: string;
		readonly textures?: Pick<PixiTileActorParticleTextures, "mote" | "spark">;
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
		textures = {
			mote: Texture.EMPTY,
			spark: Texture.EMPTY,
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
						texture: index % 4 === 0 ? textures.spark : textures.mote,
						tint,
					});
					return {
						alphaScale: 0.72 + ((index * 37) % 29) / 100,
						particle,
						phaseOffset: index / pixiTileActorActivityParticleCount,
						spreadOffset:
							(((index * 7) % pixiTileActorActivityParticleCount) /
								(pixiTileActorActivityParticleCount - 1)) *
								2 -
							1,
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
				texture: textures.mote,
			});
			container.blendMode = "add";
			container.visible = false;

			return {
				centerX: 0,
				container,
				feedbackPhase: null,
				lastProgress: 0,
				particles,
				startY: 0,
				topHalfWidth: 0,
				topY: 0,
				workingTint: tint,
			};
		}),
);
