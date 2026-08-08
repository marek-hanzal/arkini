import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";

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

describe("selectItemsFx", () => {
	it("selects canonical items by stable ID", () => {
		const selected = Effect.runSync(
			selectItemsFx({
				selector: {
					type: "item",
					itemId: "tree",
				},
				items: [
					item,
					stone,
				],
			}),
		);

		expect(selected).toEqual([
			item,
		]);
	});
});
