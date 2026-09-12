import { describe, expect, it } from "vitest";
import { calculateInitialWindowBoundsFn } from "~electron/main/window/fn/calculateInitialWindowBoundsFn";

describe("calculateInitialWindowBoundsFn", () => {
	it("centers a window at eighty-five percent of the active display work area", () => {
		expect(
			calculateInitialWindowBoundsFn({
				x: 100,
				y: 50,
				width: 1600,
				height: 1000,
			}),
		).toEqual({
			x: 220,
			y: 125,
			width: 1360,
			height: 850,
			minWidth: 480,
			minHeight: 360,
		});
	});

	it("keeps minimum bounds inside very small work areas", () => {
		expect(
			calculateInitialWindowBoundsFn({
				x: 0,
				y: 0,
				width: 320,
				height: 240,
			}),
		).toEqual({
			x: 24,
			y: 18,
			width: 272,
			height: 204,
			minWidth: 272,
			minHeight: 204,
		});
	});
});
