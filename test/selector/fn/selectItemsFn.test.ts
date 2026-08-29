import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";

const item = {
	uid: "tree",
	id: "tree",
	title: "Tree",
	description: "A living tree.",
	asset: {
		default: [
			"asset:tree",
		],
	},
	scope: "board",
	maxStackSize: 1,
	type: "simple",
} satisfies ItemSchema.Type;

const stone = {
	...item,
	uid: "stone",
	id: "stone",
	title: "Stone",
} satisfies ItemSchema.Type;

describe("selectItemsFn", () => {
	it("selects canonical items by stable ID", () => {
		const selected = selectItemsFn({
			selector: {
				type: "item",
				itemId: "tree",
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
