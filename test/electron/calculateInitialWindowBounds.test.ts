import { describe, expect, it } from "vitest";
import { calculateInitialWindowBounds } from "../../electron/main/calculateInitialWindowBounds";

describe("calculateInitialWindowBounds", () => {
	it("centers a window at three quarters of the active display work area", () => {
		expect(
			calculateInitialWindowBounds({
				x: 100,
				y: 50,
				width: 1600,
				height: 1000,
			}),
		).toEqual({
			x: 300,
			y: 175,
			width: 1200,
			height: 750,
			minWidth: 480,
			minHeight: 360,
		});
	});

	it("keeps minimum bounds inside very small work areas", () => {
		expect(
			calculateInitialWindowBounds({
				x: 0,
				y: 0,
				width: 320,
				height: 240,
			}),
		).toEqual({
			x: 40,
			y: 30,
			width: 240,
			height: 180,
			minWidth: 240,
			minHeight: 180,
		});
	});
});
