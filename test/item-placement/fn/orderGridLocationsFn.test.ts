import { describe, expect, it } from "vitest";

import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";

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

describe("orderGridLocationsFn", () => {
	it("orders locations by Manhattan distance and scan-order ties", () => {
		const result = orderGridLocationsFn({
			locations: [
				location(3),
				location(2),
				location(0),
			],
			origin: {
				x: 1,
				y: 0,
			},
		});

		expect(result).toEqual([
			location(0),
			location(2),
			location(3),
		]);
	});
});
