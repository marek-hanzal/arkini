import { describe, expect, it } from "vitest";

import { readTileDragElasticResponse } from "~/ui/tile/readTileDragElasticResponse";

const sample = ({
	deltaX = 0,
	deltaY = 0,
	velocityX = 0,
	velocityY = 0,
}: {
	readonly deltaX?: number;
	readonly deltaY?: number;
	readonly velocityX?: number;
	readonly velocityY?: number;
}) =>
	readTileDragElasticResponse({
		delta: {
			x: deltaX,
			y: deltaY,
		},
		velocity: {
			x: velocityX,
			y: velocityY,
		},
	});

describe("readTileDragElasticResponse", () => {
	it("keeps slow steady movement effectively centered", () => {
		expect(
			sample({
				deltaX: 2,
				deltaY: -2,
				velocityX: 100,
				velocityY: -80,
			}),
		).toEqual({
			x: -0,
			y: 0,
			rotation: 0,
		});
	});

	it("maps fast movement to a larger opposing response", () => {
		const response = sample({
			deltaX: 16,
			deltaY: -12,
			velocityX: 900,
			velocityY: -700,
		});

		expect(response.x).toBeLessThan(-4);
		expect(response.y).toBeGreaterThan(2);
		expect(response.rotation).toBeGreaterThan(1);
	});

	it("reverses response direction with pointer direction", () => {
		const forward = sample({
			velocityX: 1_000,
		});
		const reverse = sample({
			velocityX: -1_000,
		});

		expect(forward.x).toBeLessThan(0);
		expect(reverse.x).toBeGreaterThan(0);
		expect(reverse.x).toBe(-forward.x);
		expect(reverse.rotation).toBe(-forward.rotation);
	});

	it("bounds extreme offset and rotation", () => {
		expect(
			sample({
				deltaX: 1_000,
				deltaY: -1_000,
				velocityX: 50_000,
				velocityY: -50_000,
			}),
		).toEqual({
			x: -10,
			y: 8,
			rotation: 2.8000000000000003,
		});
	});

	it("uses a large delta when velocity sampling is unavailable", () => {
		expect(
			sample({
				deltaX: 23,
			}).x,
		).toBe(-7);
	});
});
