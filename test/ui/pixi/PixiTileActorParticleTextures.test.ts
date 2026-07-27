// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPixiTileActorParticleTexturesFx } from "~/ui/pixi/actor/createPixiTileActorParticleTexturesFx";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Pixi tile actor procedural particle textures", () => {
	it("creates two atlas slices over one private source and destroys them exactly once", () => {
		const addColorStop = vi.fn();
		const fillRect = vi.fn();
		const context = {
			addColorStop,
			createRadialGradient: vi.fn(() => ({
				addColorStop,
			})),
			fillRect,
			fillStyle: "",
			restore: vi.fn(),
			save: vi.fn(),
			scale: vi.fn(),
			translate: vi.fn(),
		};
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);

		const textures = Effect.runSync(createPixiTileActorParticleTexturesFx());

		expect(textures.mote.frame).toMatchObject({
			height: 32,
			width: 32,
			x: 0,
			y: 0,
		});
		expect(textures.spark.frame).toMatchObject({
			height: 32,
			width: 32,
			x: 32,
			y: 0,
		});
		expect(textures.mote.source).toBe(textures.spark.source);
		expect(context.createRadialGradient).toHaveBeenCalledTimes(2);
		expect(fillRect).toHaveBeenCalledTimes(2);

		Effect.runSync(textures.closeFx);
		Effect.runSync(textures.closeFx);
		expect(textures.mote.destroyed).toBe(true);
		expect(textures.spark.destroyed).toBe(true);
		expect(textures.mote.source.destroyed).toBe(true);
	});
});
