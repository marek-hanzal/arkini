import { describe, expect, it } from "vitest";

import { readTileActorVisualTarget } from "~/ui/tile/readTileActorVisualTarget";
import { readTileDeliveryOriginOffset } from "~/ui/tile/readTileDeliveryOriginOffset";

describe("tile motion grammar", () => {
	it("pulls both accepted combine actors inward to the shared 0.75 scale", () => {
		expect(
			readTileActorVisualTarget({
				phase: "dragging",
				feedback: "accepted",
				forbiddenDrop: false,
			}),
		).toMatchObject({
			opacity: 1,
			scale: 0.75,
		});
		expect(
			readTileActorVisualTarget({
				phase: "combining",
				feedback: "accepted",
				forbiddenDrop: false,
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
				forbiddenDrop: false,
			}),
		).toMatchObject({
			opacity: 0.76,
			scale: 0.84,
		});
		expect(
			readTileActorVisualTarget({
				phase: "stable",
				feedback: null,
				forbiddenDrop: false,
			}),
		).toMatchObject({
			opacity: 1,
			scale: 0.8,
		});
	});

	it("keeps the full slot while the ordinary dragged body follows at restrained opacity", () => {
		expect(
			readTileActorVisualTarget({
				phase: "dragging",
				feedback: null,
				forbiddenDrop: false,
			}),
		).toMatchObject({
			opacity: 0.8,
			scale: 0.9,
		});
	});

	it("makes rejected and outside drag targets visibly unavailable", () => {
		for (const target of [
			{ feedback: "rejected" as const, forbiddenDrop: false },
			{ feedback: null, forbiddenDrop: true },
		]) {
			expect(
				readTileActorVisualTarget({
					phase: "dragging",
					...target,
				}),
			).toMatchObject({
				opacity: 0.6,
				scale: 0.8,
			});
		}
	});

	it("makes the exact rejected target resist instead of yielding", () => {
		expect(
			readTileActorVisualTarget({
				phase: "targeted",
				feedback: "rejected",
				forbiddenDrop: false,
			}),
		).toMatchObject({
			opacity: 1,
			scale: 0.78,
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
