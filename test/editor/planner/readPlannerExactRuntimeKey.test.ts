import { describe, expect, it } from "vitest";

import { readPlannerExactRuntimeKey } from "~/editor/planner/readPlannerExactRuntimeKey";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";

const item = ItemSchema.parse({
	asset: {
		default: [
			"asset:item",
		],
	},
	description: "Item",
	id: "item",
	maxStackSize: 1,
	scope: "any",
	title: "Item",
	type: "simple",
	uid: "item",
});

const makeRuntime = ({
	reverse = false,
	revisions = [
		"revision:a",
		"revision:b",
	],
	swapOwners = false,
}: {
	readonly reverse?: boolean;
	readonly revisions?: readonly [
		string,
		string,
	];
	readonly swapOwners?: boolean;
} = {}) => {
	const items: RuntimeSchema.Type["items"] = [
		{
			id: "runtime:a",
			item,
			location: {
				position: {
					x: 0,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
			revision: revisions[0],
		},
		{
			id: "runtime:b",
			item,
			location: {
				ownerItemId: swapOwners ? "runtime:a" : "runtime:b",
				lineId: "line:owner",
				inputIndex: 0,
				scope: "input",
			},
			quantity: 1,
			revision: revisions[1],
		},
	];
	const jobs: RuntimeSchema.Type["jobs"] = [
		{
			durationMs: 100,
			id: "job:a",
			lineId: "line:owner",
			ownerItemId: swapOwners ? "runtime:b" : "runtime:a",
			remainingMs: 0,
		},
	];
	const jobQueue: NonNullable<RuntimeSchema.Type["jobQueue"]> = [
		{
			id: "queue:a",
			lineId: "line:owner",
			ownerItemId: swapOwners ? "runtime:b" : "runtime:a",
		},
	];

	return {
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: reverse
			? [
					...items,
				].reverse()
			: items,
		jobs: reverse
			? [
					...jobs,
				].reverse()
			: jobs,
		jobQueue: reverse
			? [
					...jobQueue,
				].reverse()
			: jobQueue,
	} satisfies RuntimeSchema.Type;
};

describe("readPlannerExactRuntimeKey", () => {
	it("ignores collection order and optimistic-concurrency revisions", () => {
		expect(readPlannerExactRuntimeKey(makeRuntime())).toBe(
			readPlannerExactRuntimeKey(
				makeRuntime({
					reverse: true,
					revisions: [
						"different:a",
						"different:b",
					],
				}),
			),
		);
	});

	it("preserves owner, job, queue and input relationships", () => {
		expect(readPlannerExactRuntimeKey(makeRuntime())).not.toBe(
			readPlannerExactRuntimeKey(
				makeRuntime({
					swapOwners: true,
				}),
			),
		);
	});
});
