import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";

const authored = {
	width: 3,
	height: 2,
};

describe("readEffectiveGridFootprintFx", () => {
	it("uses the canonical footprint on Board", () => {
		expect(
			Effect.runSync(
				readEffectiveGridFootprintFx({
					authored,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 2,
						},
					},
				}),
			),
		).toEqual(authored);
	});

	it.each([
		{
			scope: "inventory" as const,
			position: {
				x: 1,
				y: 2,
			},
		},
		{
			scope: "toolbar" as const,
			position: {
				x: 1,
				y: 0,
			},
		},
	])("uses one storage slot in $scope", (location) => {
		expect(
			Effect.runSync(
				readEffectiveGridFootprintFx({
					authored,
					location,
				}),
			),
		).toEqual({
			width: 1,
			height: 1,
		});
	});
});
