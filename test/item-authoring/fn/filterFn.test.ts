import { describe, expect, it } from "vitest";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { filterFn } from "~/item-authoring/fn/filterFn";

const itemFn = ({
	draft,
	id,
	layer = "content",
	title,
	type = "simple",
}: {
	readonly draft: boolean;
	readonly id: string;
	readonly layer?: ItemSchema.Type["layer"];
	readonly title: string;
	readonly type?: "producer" | "simple";
}) => ({
	...createDraftFn({
		draft,
		itemId: id,
		resourceId: `asset:${id}`,
		type,
		uid: `uid:${id}`,
	}),
	layer,
	title,
});

describe("filterFn", () => {
	it("composes layer, draft status, item type, and fuzzy query", () => {
		const matching = itemFn({
			draft: true,
			id: "item:draft-herb",
			layer: "ground",
			title: "Draft Herb",
		});
		const contentHerb = itemFn({
			draft: true,
			id: "item:content-herb",
			title: "Content Herb",
		});
		const items = [
			matching,
			contentHerb,
			itemFn({
				draft: false,
				id: "item:ready-herb",
				title: "Ready Herb",
			}),
			itemFn({
				draft: true,
				id: "producer:draft-herb",
				title: "Draft Herb Producer",
				type: "producer",
			}),
			itemFn({
				draft: true,
				id: "item:draft-stone",
				title: "Draft Stone",
			}),
		];

		expect(
			filterFn(items, {
				draft: true,
				itemType: "simple",
				layer: "ground",
				query: "herb",
			}),
		).toEqual([
			matching,
		]);
		expect(
			filterFn(items, {
				draft: false,
				query: "herb",
			}),
		).toHaveLength(4);
		expect(
			filterFn(items, {
				draft: true,
				itemType: "simple",
				layer: "content",
				query: "herb",
			}),
		).toEqual([
			contentHerb,
		]);
	});
});
