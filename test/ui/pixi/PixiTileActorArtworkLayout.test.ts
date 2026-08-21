import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiTileActorArtworkLayoutFx } from "~/ui/pixi/actor/readPixiTileActorArtworkLayoutFx";

describe("readPixiTileActorArtworkLayout", () => {
	it("keeps one tile source at the complete face bounds", () => {
		expect(
			Effect.runSync(
				readPixiTileActorArtworkLayoutFx({
					faceSize: 80,
					inset: 10,
					layered: false,
				}),
			).primary,
		).toEqual({
			x: 10,
			y: 10,
			size: 80,
		});
	});

	it("stages two tile sources from top-left to bottom-right", () => {
		expect(
			Effect.runSync(
				readPixiTileActorArtworkLayoutFx({
					faceSize: 80,
					inset: 10,
					layered: true,
				}),
			),
		).toEqual({
			primary: {
				x: 10,
				y: 10,
				size: 60,
			},
			secondary: {
				x: 30,
				y: 30,
				size: 60,
			},
		});
	});
});
