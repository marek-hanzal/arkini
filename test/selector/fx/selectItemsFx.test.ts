import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";

const item = {
	id: "tree",
	title: "Tree",
	description: "A living tree.",
	asset: {
		source: [
			"asset:tree",
		],
	},
	tags: [
		"nature",
		"forest",
	],
	categoryId: "resource",
	scope: "board",
	maxStackSize: 1,
	type: "simple",
} satisfies ItemSchema.Type;

const stone = {
	...item,
	id: "stone",
	title: "Stone",
	tags: [
		"mineral",
	],
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

	it("selects canonical items by semantic tag", () => {
		const selected = Effect.runSync(
			selectItemsFx({
				selector: {
					type: "tag",
					tag: "forest",
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
