import { describe, expect, it } from "vitest";

import { readTileDeliveryTiming } from "~/ui/tile/readTileDeliveryTiming";

describe("readTileDeliveryTiming", () => {
	it("keeps tiny delivery responsive and ordinary one-slot travel readable", () => {
		expect(
			readTileDeliveryTiming({
				offset: {
					x: 0,
					y: 0,
				},
			}).travelDuration,
		).toBe(0.72);
		expect(
			readTileDeliveryTiming({
				offset: {
					x: 96,
					y: 0,
				},
			}).travelDuration,
		).toBe(0.9);
	});

	it("grows with distance and stays bounded at the long-path ceiling", () => {
		const nearby = readTileDeliveryTiming({
			offset: {
				x: 96,
				y: 0,
			},
		});
		const medium = readTileDeliveryTiming({
			offset: {
				x: 320,
				y: 0,
			},
		});
		const long = readTileDeliveryTiming({
			offset: {
				x: 720,
				y: 0,
			},
		});
		const extreme = readTileDeliveryTiming({
			offset: {
				x: 7_200,
				y: 0,
			},
		});

		expect(medium.travelDuration).toBeGreaterThan(nearby.travelDuration);
		expect(long.travelDuration).toBeGreaterThan(medium.travelDuration);
		expect(long.travelDuration).toBe(1.4);
		expect(extreme.travelDuration).toBe(1.4);
	});

	it("uses vector magnitude and exposes the exact shared contact boundary", () => {
		const horizontal = readTileDeliveryTiming({
			offset: {
				x: 300,
				y: 400,
			},
		});
		const vertical = readTileDeliveryTiming({
			offset: {
				x: 0,
				y: -500,
			},
		});

		expect(horizontal.distance).toBe(500);
		expect(horizontal.travelDuration).toBe(vertical.travelDuration);
		expect(horizontal.contactDelay).toBe(horizontal.travelDuration);
		expect(horizontal.ease).toEqual([
			0.22,
			1,
			0.36,
			1,
		]);
	});

	it("degrades non-finite geometry to the bounded long-path policy", () => {
		const timing = readTileDeliveryTiming({
			offset: {
				x: Number.NaN,
				y: 0,
			},
		});

		expect(timing.distance).toBe(720);
		expect(timing.travelDuration).toBe(1.4);
		expect(Number.isFinite(timing.contactDelay)).toBe(true);
	});
});
