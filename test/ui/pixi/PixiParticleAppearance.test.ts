import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiParticleLightSurfaceFx } from "~/ui/pixi/appearance/readPixiParticleLightSurfaceFx";

describe("Pixi particle appearance", () => {
	it("uses backdrop-independent foreground compositing while preserving surface direction", () => {
		expect(
			Effect.runSync(
				readPixiParticleLightSurfaceFx({
					foreground: 0xfcf6ff,
					surface: 0x151020,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				readPixiParticleLightSurfaceFx({
					foreground: 0x2a1532,
					surface: 0xfffaff,
				}),
			),
		).toBe(true);
	});
});
