import { Effect } from "effect";
import { Texture } from "pixi.js";

import type { PixiTileActorRunningGlowTexture } from "~/ui/pixi/actor/PixiTileActorRunningGlowTexture";

const textureSize = 128;

/** Creates one scene-owned white radial texture that actors tint from the live accent palette. */
export const createPixiTileActorRunningGlowTextureFx = Effect.fn(
	"createPixiTileActorRunningGlowTextureFx",
)(() =>
	Effect.sync((): PixiTileActorRunningGlowTexture => {
		const canvas = document.createElement("canvas");
		canvas.width = textureSize;
		canvas.height = textureSize;
		const context = canvas.getContext("2d");
		if (context === null) {
			throw new Error("Pixi running glow texture has no Canvas 2D context.");
		}
		const radius = textureSize / 2;
		const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
		gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
		gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.92)");
		gradient.addColorStop(0.58, "rgba(255, 255, 255, 0.58)");
		gradient.addColorStop(0.82, "rgba(255, 255, 255, 0.24)");
		gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
		context.fillStyle = gradient;
		context.fillRect(0, 0, textureSize, textureSize);

		const texture = Texture.from(canvas);
		let closed = false;
		return {
			texture,
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				texture.destroy(true);
			}),
		};
	}),
);
