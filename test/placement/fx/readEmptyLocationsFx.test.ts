import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEmptyLocationsFx } from "~/engine/placement/fx/readEmptyLocationsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { boardLocation, placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

describe("readEmptyLocationsFx", () => {
	it("admits only anchors whose entire effective footprint is free and in bounds", () => {
		const item = {
			...placementTestConfig.items.log,
			footprint: {
				width: 2,
				height: 1,
			},
		};
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:blocker",
					item: placementTestConfig.items.blocker,
					location: boardLocation(2),
					quantity: 1,
					revision: "revision:blocker",
				},
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			readEmptyLocationsFx({
				item,
				locations: [
					boardLocation(0),
					boardLocation(1),
					boardLocation(2),
					boardLocation(3),
				],
				runtime,
			}),
		);

		expect(result).toEqual([
			boardLocation(0),
		]);
	});
});
