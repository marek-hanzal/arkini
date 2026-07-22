import { describe, expect, it } from "vitest";

import { readTileActorVisualTarget } from "~/ui/tile/readTileActorVisualTarget";
import { readTileDeliveryOriginOffset } from "~/ui/tile/readTileDeliveryOriginOffset";

describe("tile motion grammar", () => {
	it("pulls both accepted combine actors inward to the shared 0.75 scale", () => {
		expect(
			readTileActorVisualTarget({
				phase: "dragging",
				feedback: "accepted",
			}),
		).toMatchObject({
			opacity: 1,
			scale: 0.75,
		});
		expect(
			readTileActorVisualTarget({
				phase: "combining",
				feedback: "accepted",
			}),
		).toMatchObject({
			opacity: 1,
			scale: 0.75,
		});
	});

	it("dims and shrinks only the held actor for a non-combinable occupied target", () => {
		expect(
			readTileActorVisualTarget({
				phase: "dragging",
				feedback: "ignored",
			}),
		).toMatchObject({
			opacity: 0.76,
			scale: 0.84,
		});
		expect(
			readTileActorVisualTarget({
				phase: "stable",
				feedback: null,
			}),
		).toMatchObject({
			opacity: 1,
			scale: 1,
		});
	});

	it("measures a delivery from the origin actor center to the target slot center", () => {
		expect(
			readTileDeliveryOriginOffset({
				actorLayerRect: {
					left: 100,
					top: 50,
					width: 800,
					height: 600,
				},
				originRect: {
					left: 180,
					top: 110,
					width: 80,
					height: 80,
				},
				targetPlacement: {
					x: 300,
					y: 200,
					width: 100,
					height: 100,
				},
			}),
		).toEqual({
			x: -230,
			y: -140,
		});
	});
});
