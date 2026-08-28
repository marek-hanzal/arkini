import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { orderGridLocationsFx } from "~/engine/placement/fx/orderGridLocationsFx";

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

describe("orderGridLocationsFx", () => {
	it("orders locations by Manhattan distance and scan-order ties", () => {
		const result = Effect.runSync(
			orderGridLocationsFx({
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
