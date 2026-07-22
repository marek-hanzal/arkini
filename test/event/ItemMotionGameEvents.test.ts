import { describe, expect, it } from "vitest";

import { GameEventSchema } from "~/engine/event/schema/GameEventSchema";

const location = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

describe("item motion game events", () => {
	it.each([
		{
			type: "item:spawned",
			itemId: "runtime:spawned",
			canonicalItemId: "water",
			location,
			quantity: 1,
		},
		{
			type: "item:stacked",
			itemId: "runtime:stack",
			canonicalItemId: "water",
			location,
			previousQuantity: 1,
			quantity: 2,
		},
		{
			type: "item:split",
			itemId: "runtime:split",
			canonicalItemId: "water",
			location,
			previousQuantity: 2,
			quantity: 1,
		},
		{
			type: "item:consumed",
			itemId: "runtime:input",
			consumedItemId: "runtime:consumed",
			canonicalItemId: "water",
			previousLocation: {
				scope: "input",
				ownerItemId: "runtime:owner",
				lineId: "line:owner:run",
				inputIndex: 0,
			},
			location: {
				scope: "job",
				jobId: "runtime:job",
			},
			previousQuantity: 2,
			consumedQuantity: 1,
			quantity: 1,
		},
		{
			type: "item:expired",
			itemId: "runtime:temporary",
			canonicalItemId: "temporary",
			location,
			quantity: 1,
		},
		{
			type: "item:depleted",
			itemId: "runtime:deposit",
			canonicalItemId: "tree",
			location,
			previousQuantity: 2,
			quantity: 1,
		},
		{
			type: "item:removed",
			itemId: "runtime:removed",
			canonicalItemId: "water",
			location,
			quantity: 1,
			reason: "consumed",
		},
		{
			type: "item:replaced",
			outgoingItemId: "runtime:old",
			outgoingCanonicalItemId: "sapling",
			incomingItemId: "runtime:new",
			incomingCanonicalItemId: "tree",
			location,
		},
	])("accepts $type as an exact committed fact", (event) => {
		expect(GameEventSchema.parse(event)).toEqual(event);
	});

	it("rejects presentation vocabulary in engine facts", () => {
		expect(() =>
			GameEventSchema.parse({
				type: "item:spawned",
				itemId: "runtime:spawned",
				canonicalItemId: "water",
				location,
				quantity: 1,
				animation: "bounce",
			}),
		).toThrow();
	});
});
