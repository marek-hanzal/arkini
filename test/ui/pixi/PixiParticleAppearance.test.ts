import { describe, expect, it } from "vitest";

import { readPixiParticleBlendMode } from "~/ui/pixi/appearance/readPixiParticleBlendMode";

describe("Pixi particle appearance", () => {
	it("keeps dark-theme luminosity and light-theme chromatic contrast", () => {
		expect(
			readPixiParticleBlendMode({
				foreground: 0xfcf6ff,
				surface: 0x151020,
			}),
		).toBe("add");
		expect(
			readPixiParticleBlendMode({
				foreground: 0x2a1532,
				surface: 0xfffaff,
			}),
		).toBe("normal");
	});
});
