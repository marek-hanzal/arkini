import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";

const item = {
	maxQueueSize: 1,
	ui: "default",
	lines: [],

	uid: "tree",
	title: "Tree",
	description: "A living tree.",
	artwork: {
		scale: 0.8,
		default: [
			"artwork:tree",
		],
	},
} satisfies ItemSchema.Type;

const stone = {
	...item,
	uid: "stone",
	title: "Stone",
} satisfies ItemSchema.Type;

describe("selectItemsFn", () => {
	it("selects canonical items by stable ID", () => {
		const selected = selectItemsFn({
			selector: {
				type: "item",
				itemUid: "tree",
			},
			items: [
				item,
				stone,
			],
		});

		expect(selected).toEqual([
			item,
		]);
	});
});
