import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { selectorFx } from "~/v1/selector/fx/selectorFx";

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

describe("selectorFx", () => {
	it("matches a canonical item by its stable ID", () => {
		const selected = Effect.runSync(
			selectorFx({
				selector: {
					type: "item",
					itemId: "tree",
				},
				item,
			}),
		);
		const rejected = Effect.runSync(
			selectorFx({
				selector: {
					type: "item",
					itemId: "stone",
				},
				item,
			}),
		);

		expect(selected).toBe(true);
		expect(rejected).toBe(false);
	});

	it("matches a canonical item by one of its semantic tags", () => {
		const selected = Effect.runSync(
			selectorFx({
				selector: {
					type: "tag",
					tag: "forest",
				},
				item,
			}),
		);
		const rejected = Effect.runSync(
			selectorFx({
				selector: {
					type: "tag",
					tag: "mineral",
				},
				item,
			}),
		);

		expect(selected).toBe(true);
		expect(rejected).toBe(false);
	});
});
