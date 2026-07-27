import { Effect } from "effect";
import { Rectangle, Texture } from "pixi.js";

import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";

const textureSize = 32;

/** Creates one private procedural atlas with a soft mote and a narrow rising spark. */
export const createPixiTileActorParticleTexturesFx = Effect.fn(
	"createPixiTileActorParticleTexturesFx",
)(() =>
	Effect.sync((): PixiTileActorParticleTextures => {
		const canvas = document.createElement("canvas");
		canvas.width = textureSize * 2;
		canvas.height = textureSize;
		const context = canvas.getContext("2d");
		if (context === null) {
			throw new Error("Pixi activity particle atlas has no Canvas 2D context.");
		}

		const center = textureSize / 2;
		const moteGradient = context.createRadialGradient(
			center,
			center,
			0,
			center,
			center,
			center,
		);
		moteGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
		moteGradient.addColorStop(0.24, "rgba(255, 255, 255, 0.94)");
		moteGradient.addColorStop(0.62, "rgba(255, 255, 255, 0.38)");
		moteGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
		context.fillStyle = moteGradient;
		context.fillRect(0, 0, textureSize, textureSize);

		const sparkCenterX = textureSize + center;
		const sparkGradient = context.createRadialGradient(
			sparkCenterX,
			center,
			0,
			sparkCenterX,
			center,
			center,
		);
		sparkGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
		sparkGradient.addColorStop(0.18, "rgba(255, 255, 255, 0.9)");
		sparkGradient.addColorStop(0.54, "rgba(255, 255, 255, 0.3)");
		sparkGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
		context.save();
		context.translate(sparkCenterX, center);
		context.scale(0.42, 1);
		context.translate(-sparkCenterX, -center);
		context.fillStyle = sparkGradient;
		context.fillRect(textureSize, 0, textureSize, textureSize);
		context.restore();

		const atlas = Texture.from(canvas, true);
		const mote = new Texture({
			frame: new Rectangle(0, 0, textureSize, textureSize),
			label: "TileActivityParticleMote",
			source: atlas.source,
		});
		const spark = new Texture({
			frame: new Rectangle(textureSize, 0, textureSize, textureSize),
			label: "TileActivityParticleSpark",
			source: atlas.source,
		});
		let closed = false;
		return {
			mote,
			spark,
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				mote.destroy(false);
				spark.destroy(false);
				atlas.destroy(true);
			}),
		};
	}),
);
