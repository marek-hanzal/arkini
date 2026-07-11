import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planStackPlacementFx } from "~/v1/placement/fx/planStackPlacementFx";
import { placementTestConfig, boardLocation } from "~test/placement/fx/support/placementTestConfig";

const log = placementTestConfig.items.log;

describe("planStackPlacementFx", () => {
	it("fills ordered stacks without exceeding maxStackSize", () => {
		const result = Effect.runSync(
			planStackPlacementFx({
				items: [
					{
						id: "runtime:first",
						item: log,
						location: boardLocation(0),
						quantity: 2,
					},
					{
						id: "runtime:second",
						item: log,
						location: boardLocation(1),
						quantity: 1,
					},
				],
				quantity: 4,
			}),
		);

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
