import { describe, expect, it } from "vitest";

import { planStackPlacementFn } from "~/engine/placement/fn/planStackPlacementFn";
import { placementTestConfig, boardLocation } from "~test/placement/fx/support/placementTestConfig";

const log = placementTestConfig.items.log;

describe("planStackPlacementFn", () => {
	it("fills ordered stacks without exceeding maxStackSize", () => {
		const result = planStackPlacementFn({
			items: [
				{
					id: "runtime:first",
					item: log,
					location: boardLocation(0),
					quantity: 2,
					revision: "revision:first",
				},
				{
					id: "runtime:second",
					item: log,
					location: boardLocation(1),
					quantity: 1,
					revision: "revision:second",
				},
			],
			quantity: 4,
		});

		expect(result).toEqual([
			{
				itemId: "runtime:first",
				quantity: 1,
			},
			{
				itemId: "runtime:second",
				quantity: 2,
			},
		]);
	});
});
