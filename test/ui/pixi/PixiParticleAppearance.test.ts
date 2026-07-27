import { describe, expect, it } from "vitest";

import {
	readPixiParticleBlendMode,
	readPixiParticleLightSurface,
} from "~/ui/pixi/appearance/readPixiParticleBlendMode";

describe("Pixi particle appearance", () => {
	it("uses backdrop-independent foreground compositing while preserving surface direction", () => {
		expect(readPixiParticleBlendMode()).toBe("normal");
		expect(
			readPixiParticleLightSurface({
				foreground: 0xfcf6ff,
				surface: 0x151020,
			}),
		).toBe(false);
		expect(
			readPixiParticleLightSurface({
				foreground: 0x2a1532,
				surface: 0xfffaff,
			}),
		).toBe(true);
	});
});
