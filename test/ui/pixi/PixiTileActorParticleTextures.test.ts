// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPixiTileActorParticleTexturesFx } from "~/ui/pixi/actor/createPixiTileActorParticleTexturesFx";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Pixi tile actor procedural particle textures", () => {
	it("creates one five-point star texture and destroys it exactly once", () => {
		const context = {
			beginPath: vi.fn(),
			closePath: vi.fn(),
			fill: vi.fn(),
			fillStyle: "",
			lineTo: vi.fn(),
			moveTo: vi.fn(),
		};
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);

		const textures = Effect.runSync(createPixiTileActorParticleTexturesFx());

		expect(textures.star.frame).toMatchObject({
			height: 32,
			width: 32,
			x: 0,
			y: 0,
		});
		expect(context.moveTo).toHaveBeenCalledTimes(1);
		expect(context.lineTo).toHaveBeenCalledTimes(9);
		expect(context.closePath).toHaveBeenCalledTimes(1);
		expect(context.fill).toHaveBeenCalledTimes(1);

		const source = textures.star.source;
		Effect.runSync(textures.closeFx);
		Effect.runSync(textures.closeFx);
		expect(textures.star.destroyed).toBe(true);
		expect(source.destroyed).toBe(true);
	});
});
