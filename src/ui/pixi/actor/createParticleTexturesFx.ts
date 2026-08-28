import { Effect } from "effect";
import { Texture } from "pixi.js";

import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";

const textureSize = 32;

/** Creates one private procedural five-point star shared by every retained particle. */
export const createParticleTexturesFx = Effect.fn("createParticleTexturesFx")(() =>
	Effect.sync((): PixiTileActorParticleTextures => {
		const canvas = document.createElement("canvas");
		canvas.width = textureSize;
		canvas.height = textureSize;
		const context = canvas.getContext("2d");
		if (context === null) {
			throw new Error("Pixi activity particle atlas has no Canvas 2D context.");
		}

		const center = textureSize / 2;
		const outerRadius = textureSize * 0.46;
		const innerRadius = outerRadius * 0.43;
		context.beginPath();
		for (let point = 0; point < 10; point += 1) {
			const radius = point % 2 === 0 ? outerRadius : innerRadius;
			const angle = -Math.PI / 2 + (point * Math.PI) / 5;
			const x = center + Math.cos(angle) * radius;
			const y = center + Math.sin(angle) * radius;
			if (point === 0) context.moveTo(x, y);
			else context.lineTo(x, y);
		}
		context.closePath();
		context.fillStyle = "rgba(255, 255, 255, 1)";
		context.fill();

		const star = Texture.from(canvas, true);
		star.label = "TileActivityParticleStar";
		let closed = false;
		return {
			star,
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				star.destroy(true);
			}),
		};
	}),
);
