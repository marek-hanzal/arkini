import { describe, expect, it } from "vitest";

import { readPixiTileActorArtworkLayout } from "~/ui/pixi/actor/updatePixiTileActorVisualFx";

describe("readPixiTileActorArtworkLayout", () => {
	it("keeps one tile source at the complete face bounds", () => {
		expect(
			readPixiTileActorArtworkLayout({
				faceSize: 80,
				inset: 10,
				layered: false,
			}).primary,
		).toEqual({
			x: 10,
			y: 10,
			size: 80,
		});
	});

	it("stages two tile sources from top-left to bottom-right", () => {
		expect(
			readPixiTileActorArtworkLayout({
				faceSize: 80,
				inset: 10,
				layered: true,
			}),
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
