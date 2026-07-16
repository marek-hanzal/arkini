import { describe, expect, it } from "vitest";

import { DropPlacementResultSchema } from "~/engine/placement/schema/DropPlacementResultSchema";
import { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";

const runtimeItem = {
	id: "runtime:log",
	item: {
		id: "log",
		title: "Log",
		description: "A log.",
		asset: {
			source: [
				"asset:log",
			],
		},
		tags: [],
		categoryId: "resource",
		scope: "any",
		maxStackSize: 10,
		type: "simple",
	},
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 1,
			y: 2,
		},
	},
	quantity: 3,
	revision: "revision:runtime-log",
} as const;

describe("placement schemas", () => {
	it("accepts explicit remove, stack, and spawn plans", () => {
		expect(
			PlacementPlanSchema.parse({
				remove: [
					"runtime:source",
				],
				stack: [
					{
						itemId: "runtime:log",
						quantity: 2,
					},
				],
				spawn: [
					{
						item: runtimeItem,
					},
				],
			}),
		).toEqual({
			remove: [
				"runtime:source",
			],
			stack: [
				{
					itemId: "runtime:log",
					quantity: 2,
				},
			],
			spawn: [
				{
					item: runtimeItem,
				},
			],
		});
	});

	it("accepts concrete drop and output placement results", () => {
		const drop = {
			drop: {
				itemId: "log",
				placement: "drop",
				quantity: 2,
			},
			placement: {
				remove: [],
				stack: [],
				spawn: [
					runtimeItem,
				],
			},
		};

		expect(DropPlacementResultSchema.parse(drop)).toEqual(drop);
		expect(
			OutputPlacementResultSchema.parse({
				drop: [
					drop,
				],
			}),
		).toEqual({
			drop: [
				drop,
			],
		});
	});

	it("accepts only explicit placement failure reasons", () => {
		expect(PlacementFailureReasonEnumSchema.parse("board:full")).toBe("board:full");
		expect(() => PlacementFailureReasonEnumSchema.parse("something:shrug")).toThrow();
	});
});
