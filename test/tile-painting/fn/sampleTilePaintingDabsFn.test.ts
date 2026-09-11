import { describe, expect, it } from "vitest";
import { sampleTilePaintingDabsFn } from "~/tile-painting/fn/sampleTilePaintingDabsFn";

describe("sampleTilePaintingDabsFn", () => {
	it("keeps identical dab positions when the browser partitions a straight stroke into events", () => {
		const whole = sampleTilePaintingDabsFn({
			from: {
				x: 0,
				y: 0,
			},
			to: {
				x: 30,
				y: 40,
			},
			spacing: 7,
			distanceToNext: 7,
		});
		let from = {
			x: 0,
			y: 0,
		};
		let distanceToNext = 7;
		const points = [];
		for (const ratio of [
			0.03,
			0.19,
			0.51,
			0.57,
			1,
		]) {
			const to = {
				x: 30 * ratio,
				y: 40 * ratio,
			};
			const sampled = sampleTilePaintingDabsFn({
				from,
				to,
				spacing: 7,
				distanceToNext,
			});
			points.push(...sampled.points);
			distanceToNext = sampled.distanceToNext;
			from = to;
		}
		expect(points).toHaveLength(whole.points.length);
		points.forEach((point, index) => {
			expect(point.x).toBeCloseTo(whole.points[index].x);
			expect(point.y).toBeCloseTo(whole.points[index].y);
		});
		expect(distanceToNext).toBeCloseTo(whole.distanceToNext);
	});

	it("carries spacing through corners without emitting an extra dab at an event boundary", () => {
		const first = sampleTilePaintingDabsFn({
			from: {
				x: 0,
				y: 0,
			},
			to: {
				x: 6,
				y: 0,
			},
			spacing: 10,
			distanceToNext: 10,
		});
		const second = sampleTilePaintingDabsFn({
			from: {
				x: 6,
				y: 0,
			},
			to: {
				x: 6,
				y: 14,
			},
			spacing: 10,
			distanceToNext: first.distanceToNext,
		});
		expect(first.points).toEqual([]);
		expect(second.points).toEqual([
			{
				x: 6,
				y: 4,
			},
			{
				x: 6,
				y: 14,
			},
		]);
		expect(second.distanceToNext).toBe(10);
	});
});
