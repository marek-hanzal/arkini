import { describe, expect, it } from "vitest";
import { clampDragDelta } from "~/tile-engine/clampDragDelta";

describe("clampDragDelta", () => {
	it("keeps the dragged rect inside the bounds", () => {
		expect(
			clampDragDelta({
				x: 100,
				y: -40,
				origin: {
					left: 20,
					top: 20,
					width: 30,
					height: 30,
				},
				bounds: {
					left: 0,
					top: 0,
					width: 100,
					height: 100,
				},
			}),
		).toEqual({
			x: 50,
			y: -20,
		});
	});

	it("passes deltas through without bounds", () => {
		expect(
			clampDragDelta({
				x: 123,
				y: -456,
				origin: {
					left: 0,
					top: 0,
					width: 10,
					height: 10,
				},
				bounds: null,
			}),
		).toEqual({
			x: 123,
			y: -456,
		});
	});
});
