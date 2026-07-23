import { describe, expect, it } from "vitest";

import { readTileDirectionalImpactResponse } from "~/ui/tile/readTileDirectionalImpactResponse";

describe("readTileDirectionalImpactResponse", () => {
	it("compresses the incoming horizontal axis and compensates orthogonally", () => {
		expect(
			readTileDirectionalImpactResponse({
				originToTarget: {
					x: 100,
					y: 0,
				},
			}),
		).toEqual({
			primaryAxis: "x",
			scaleX: 0.9,
			scaleY: 1.06,
			rotation: -2.4,
		});
	});

	it("compresses the incoming vertical axis and preserves its signed rotation", () => {
		const downward = readTileDirectionalImpactResponse({
			originToTarget: {
				x: 0,
				y: 80,
			},
		});
		const upward = readTileDirectionalImpactResponse({
			originToTarget: {
				x: 0,
				y: -80,
			},
		});

		expect(downward).toEqual({
			primaryAxis: "y",
			scaleX: 1.06,
			scaleY: 0.9,
			rotation: 2.4,
		});
		expect(upward.rotation).toBe(-2.4);
	});

	it("normalizes diagonal direction and keeps rotation bounded", () => {
		const response = readTileDirectionalImpactResponse({
			originToTarget: {
				x: 10_000,
				y: 9_000,
			},
		});

		expect(response.primaryAxis).toBe("x");
		expect(response.rotation).toBeGreaterThanOrEqual(-2.4);
		expect(response.rotation).toBeLessThanOrEqual(2.4);
	});

	it("uses a neutral pose when origin and target have no usable separation", () => {
		expect(
			readTileDirectionalImpactResponse({
				originToTarget: {
					x: 0,
					y: 0,
				},
			}),
		).toEqual({
			primaryAxis: null,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
	});

	it.each([
		{
			x: Number.NaN,
			y: 0,
		},
		{
			x: Number.POSITIVE_INFINITY,
			y: 1,
		},
	])("keeps non-finite geometry out of Motion transforms", (originToTarget) => {
		expect(
			readTileDirectionalImpactResponse({
				originToTarget,
			}),
		).toEqual({
			primaryAxis: null,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
	});
});
