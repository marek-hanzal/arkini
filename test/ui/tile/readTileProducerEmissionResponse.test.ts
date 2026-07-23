import { describe, expect, it } from "vitest";

import { readTileProducerEmissionResponse } from "~/ui/tile/readTileProducerEmissionResponse";

describe("readTileProducerEmissionResponse", () => {
	it("squeezes and recoils against a horizontal target direction", () => {
		expect(
			readTileProducerEmissionResponse({
				originToTarget: {
					x: 200,
					y: 0,
				},
			}),
		).toEqual({
			direction: {
				x: 1,
				y: 0,
			},
			anticipation: {
				primaryAxis: "x",
				scaleX: 0.9,
				scaleY: 1.06,
			},
			recoil: {
				x: -6,
				y: -0,
			},
			hop: {
				x: 4,
				y: 0,
			},
		});
	});

	it("uses the vertical axis for a target below the producer", () => {
		expect(
			readTileProducerEmissionResponse({
				originToTarget: {
					x: 0,
					y: 100,
				},
			}),
		).toEqual({
			direction: {
				x: 0,
				y: 1,
			},
			anticipation: {
				primaryAxis: "y",
				scaleX: 1.06,
				scaleY: 0.9,
			},
			recoil: {
				x: -0,
				y: -6,
			},
			hop: {
				x: 0,
				y: 4,
			},
		});
	});

	it("normalizes diagonal offsets so recoil and hop stay bounded", () => {
		const response = readTileProducerEmissionResponse({
			originToTarget: {
				x: 3_000,
				y: 4_000,
			},
		});

		expect(Math.hypot(response.recoil.x, response.recoil.y)).toBeCloseTo(6);
		expect(Math.hypot(response.hop.x, response.hop.y)).toBeCloseTo(4);
		expect(response.recoil.x).toBeLessThan(0);
		expect(response.recoil.y).toBeLessThan(0);
		expect(response.hop.x).toBeGreaterThan(0);
		expect(response.hop.y).toBeGreaterThan(0);
	});

	it("falls back to a neutral upward gesture without a usable target vector", () => {
		expect(
			readTileProducerEmissionResponse({
				originToTarget: {
					x: 0,
					y: 0,
				},
			}),
		).toEqual({
			direction: {
				x: 0,
				y: -1,
			},
			anticipation: {
				primaryAxis: "y",
				scaleX: 1.06,
				scaleY: 0.9,
			},
			recoil: {
				x: -0,
				y: 6,
			},
			hop: {
				x: 0,
				y: -4,
			},
		});
	});

	it.each([
		{
			x: Number.NaN,
			y: 0,
		},
		{
			x: Number.NEGATIVE_INFINITY,
			y: 1,
		},
	])("keeps non-finite geometry out of Motion transforms", (originToTarget) => {
		expect(
			readTileProducerEmissionResponse({
				originToTarget,
			}),
		).toEqual({
			direction: {
				x: 0,
				y: -1,
			},
			anticipation: {
				primaryAxis: "y",
				scaleX: 1.06,
				scaleY: 0.9,
			},
			recoil: {
				x: -0,
				y: 6,
			},
			hop: {
				x: 0,
				y: -4,
			},
		});
	});
});
