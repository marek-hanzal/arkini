import { describe, expect, it } from "vitest";

import { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { ItemRemovedReasonEnumSchema } from "~/engine/event/schema/ItemRemovedReasonEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

const location = {
	scope: LocationScopeEnumSchema.enum.Board,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
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
			itemId: "runtime:input",
			consumedItemId: "runtime:consumed",
			canonicalItemId: "water",
			previousLocation: {
				scope: LocationScopeEnumSchema.enum.Input,
				ownerItemId: "runtime:owner",
				lineId: "line:owner:run",
				inputIndex: 0,
			},
			location: {
				scope: LocationScopeEnumSchema.enum.Job,
				jobId: "runtime:job",
			},
			previousQuantity: 2,
			consumedQuantity: 1,
			quantity: 1,
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
			quantity: 1,
		},
		{
			type: GameEventEnumSchema.enum.ItemRemoved,
			itemId: "runtime:removed",
			canonicalItemId: "water",
			location,
			quantity: 1,
			reason: ItemRemovedReasonEnumSchema.enum.Consumed,
		},
		{
			type: GameEventEnumSchema.enum.ItemReplaced,
			outgoingItemId: "runtime:old",
			outgoingCanonicalItemId: "sapling",
			outgoingQuantity: 1,
			incomingItemId: "runtime:new",
			incomingCanonicalItemId: "tree",
			incomingQuantity: 2,
			location,
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
