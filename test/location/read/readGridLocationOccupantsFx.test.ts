import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

const log = placementTestConfig.items.log;

const boardLocation = (space: number, x: number): GridLocationSchema.Type => ({
	scope: "board",
	space,
	position: {
		x,
		y: 0,
	},
});

const runtimeItem = (
	id: string,
	location: GridLocationSchema.Type,
): GridRuntimeItemSchema.Type => ({
	id,
	item: log,
	location,
	quantity: 1,
	revision: `revision:${id}`,
});

describe("readGridLocationOccupantsFx", () => {
	it("groups by full slot identity while preserving requested location and item order", () => {
		const firstSpaceZero = boardLocation(0, 1);
		const duplicateSpaceZero = boardLocation(0, 1);
		const spaceOne = boardLocation(1, 1);
		const empty = {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		} satisfies GridLocationSchema.Type;

		const result = Effect.runSync(
			readGridLocationOccupantsFx({
				items: [
					runtimeItem("runtime:first", firstSpaceZero),
					runtimeItem("runtime:other-space", spaceOne),
					runtimeItem("runtime:second", duplicateSpaceZero),
				],
				locations: [
					firstSpaceZero,
					duplicateSpaceZero,
					spaceOne,
					empty,
				],
			}),
		);

		expect(result).toHaveLength(3);
		expect(result[0]?.location).toBe(firstSpaceZero);
		expect(result[0]?.items.map((item) => item.id)).toEqual([
			"runtime:first",
			"runtime:second",
		]);
		expect(result[1]?.items.map((item) => item.id)).toEqual([
			"runtime:other-space",
		]);
		expect(result[2]).toEqual({
			location: empty,
			items: [],
		});
	});
});
