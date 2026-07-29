import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import {
	boardLocation,
	inventoryLocation,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

describe("readGridLocationClaimsFx", () => {
	it("expands a Board delivery origin but keeps a storage origin to one slot", () => {
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
					id: "runtime:board-delivery",
					item,
					location: {
						scope: "delivery",
						phase: "returning",
						generation: 0,
						origin: boardLocation(1),
						returnFrom: boardLocation(3),
					},
					quantity: 1,
					revision: "revision:board",
				},
				{
					id: "runtime:inventory-delivery",
					item,
					location: {
						scope: "delivery",
						phase: "returning",
						generation: 0,
						origin: inventoryLocation(0),
						returnFrom: boardLocation(3),
					},
					quantity: 1,
					revision: "revision:inventory",
				},
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			readGridLocationClaimsFx({
				runtime,
			}),
		);

		expect(
			result.map(({ itemId, location }) => [
				itemId,
				location,
			]),
		).toEqual([
			[
				"runtime:board-delivery",
				boardLocation(1),
			],
			[
				"runtime:board-delivery",
				boardLocation(2),
			],
			[
				"runtime:inventory-delivery",
				inventoryLocation(0),
			],
		]);
	});
});
