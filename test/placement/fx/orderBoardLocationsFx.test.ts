import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { orderBoardLocationsFx } from "~/engine/placement/fx/orderBoardLocationsFx";
import { placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

const location = (x: number, y = 0) => {
	return {
		space: 0,
		position: {
			x,
			y,
		},
		scope: "board" as const,
	};
};

describe("orderBoardLocationsFx", () => {
	it("orders locations by Manhattan distance and scan-order ties", () => {
		const result = Effect.runSync(
			orderBoardLocationsFx({
				item: placementTestConfig.items.log,
				locations: [
					location(3),
					location(2),
					location(0),
				],
				origin: {
					space: 0,
					anchor: {
						x: 1,
						y: 0,
					},
					footprint: {
						width: 1,
						height: 1,
					},
				},
			}),
		);

		expect(result).toEqual([
			location(0),
			location(2),
			location(3),
		]);
	});

	it("orders candidate rectangles by their nearest occupied cell", () => {
		const result = Effect.runSync(
			orderBoardLocationsFx({
				item: {
					...placementTestConfig.items.log,
					footprint: {
						width: 2,
						height: 1,
					},
				},
				locations: [
					location(4),
					location(0),
					location(3),
				],
				origin: {
					space: 0,
					anchor: {
						x: 2,
						y: 0,
					},
					footprint: {
						width: 1,
						height: 1,
					},
				},
			}),
		);

		expect(result).toEqual([
			location(0),
			location(3),
			location(4),
		]);
	});
});
