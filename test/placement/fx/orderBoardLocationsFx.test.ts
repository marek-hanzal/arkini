import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { orderBoardLocationsFx } from "~/engine/placement/fx/orderBoardLocationsFx";

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
				locations: [
					location(3),
					location(2),
					location(0),
				],
				origin: {
					x: 1,
					y: 0,
				},
			}),
		);

		expect(result).toEqual([
			location(0),
			location(2),
			location(3),
		]);
	});
});
