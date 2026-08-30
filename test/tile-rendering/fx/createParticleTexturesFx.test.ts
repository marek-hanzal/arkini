// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createParticleTexturesFx } from "~/tile-rendering/fx/createParticleTexturesFx";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("particle textures", () => {
	it("destroys the shared texture and source exactly once", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			beginPath: vi.fn(),
			closePath: vi.fn(),
			fill: vi.fn(),
			fillStyle: "",
			lineTo: vi.fn(),
			moveTo: vi.fn(),
		} as never);
		const textures = Effect.runSync(createParticleTexturesFx());
		const source = textures.star.source;

		Effect.runSync(textures.closeFx);
		Effect.runSync(textures.closeFx);

		expect(textures.star.destroyed).toBe(true);
		expect(source.destroyed).toBe(true);
	});
});
