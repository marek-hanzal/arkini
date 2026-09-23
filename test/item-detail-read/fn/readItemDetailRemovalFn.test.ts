import { expect, it } from "vitest";
import { readItemDetailRemovalFn } from "~/item-detail-read/fn/readItemDetailRemovalFn";
import { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";

const base = lineRunRuntime({});
const previous = {
	...base,
	items: [
		{
			...base.items[0],
			remainingUnits: 1,
			item: {
				...base.items[0].item,
				units: {
					amount: 8,
				},
			},
		},
	],
};
const owner = previous.items[0];
const depleted = {
	type: "item:depleted",
	itemId: owner.id,
	itemUid: owner.item.uid,
	location: owner.location,
};

it("retains zero units from the removal commit instead of the outgoing positive balance", () => {
	const transition = CommittedTransitionSchema.parse({
		sequence: 1,
		previousRuntime: previous,
		runtime: {
			...previous,
			items: [],
		},
		events: [
			{
				type: "item:removed",
				snapshot: {
					...owner,
					remainingUnits: 0,
				},
			},
			depleted,
		],
	});
	expect(readItemDetailRemovalFn(transition, owner.id)).toEqual({
		snapshot: {
			...owner,
			remainingUnits: 0,
		},
		reason: "depleted",
	});
	expect(previous.items[0].remainingUnits).toBe(1);
});

it("reads the whole terminal snapshot without reconstructing it from the previous commit", () => {
	const final = {
		...owner,
		remainingUnits: 0,
		revision: "terminal-revision",
		mergeSequence: 7,
		item: {
			...owner.item,
			description: "Final authored description",
		},
	};
	const transition = CommittedTransitionSchema.parse({
		sequence: 1,
		previousRuntime: {
			...previous,
			items: [
				{
					...owner,
					remainingUnits: 5,
				},
			],
		},
		runtime: {
			...previous,
			items: [],
		},
		events: [
			{
				type: "item:removed",
				snapshot: final,
			},
			{
				type: "item:expired",
				itemId: owner.id,
				itemUid: owner.item.uid,
				location: owner.location,
			},
		],
	});
	expect(readItemDetailRemovalFn(transition, owner.id)).toMatchObject({
		snapshot: final,
		reason: "expired",
	});
	expect(readItemDetailRemovalFn(transition, "another-instance")).toBeUndefined();
});
