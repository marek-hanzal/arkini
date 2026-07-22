import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

const location = {
	scope: LocationScopeEnumSchema.enum.Board,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

const inputLocation = {
	scope: LocationScopeEnumSchema.enum.Input,
	ownerItemId: "runtime:owner",
	lineId: "line:owner:run",
	inputIndex: 0,
};

describe("item motion game events", () => {
	it.each([
		{
			type: GameEventEnumSchema.enum.ItemSpawned,
			itemId: "runtime:spawned",
			canonicalItemId: "water",
			location,
			quantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemPlaced,
			itemId: "runtime:placed",
			canonicalItemId: "tool",
			previousLocation: inputLocation,
			location,
			quantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemStacked,
			itemId: "runtime:stack",
			canonicalItemId: "water",
			location,
			previousQuantity: 1,
			quantity: 2,
		},
		{
			type: GameEventEnumSchema.enum.ItemSplit,
			itemId: "runtime:split",
			canonicalItemId: "water",
			location,
			previousQuantity: 2,
			quantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemConsumed,
			sourceItemId: "runtime:input",
			canonicalItemId: "water",
			sourceLocation: inputLocation,
			previousQuantity: 2,
			consumedQuantity: 1,
			resultingQuantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemExpired,
			itemId: "runtime:temporary",
			canonicalItemId: "temporary",
			location,
			quantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: "runtime:deposit",
			canonicalItemId: "tree",
			location,
			previousQuantity: 2,
			resultingQuantity: 1,
		},
	])("accepts $type as an exact committed fact", (event) => {
		expect(GameEventSchema.parse(event)).toEqual(event);
	});

	it("rejects presentation vocabulary in engine facts", () => {
		expect(() =>
			GameEventSchema.parse({
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:spawned",
				canonicalItemId: "water",
				location,
				quantity: 1,
				animation: "bounce",
			}),
		).toThrow();
	});
});
