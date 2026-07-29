import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import { boardLocation, placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

describe("planSpawnPlacementFx", () => {
	it("reserves every occupied cell between planned stacks", () => {
		const item = {
			...placementTestConfig.items.log,
			footprint: {
				width: 2,
				height: 1,
			},
			maxStackSize: 1,
		};
		const result = Effect.runSync(
			planSpawnPlacementFx({
				item,
				locations: [
					boardLocation(0),
					boardLocation(1),
					boardLocation(2),
					boardLocation(3),
				],
				quantity: 2,
			}),
		);

		expect(result.map(({ item }) => item.location.position.x)).toEqual([
			0,
			2,
		]);
	});
});
