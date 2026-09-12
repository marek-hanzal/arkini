import { describe, expect, it } from "vitest";

import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { filterFn } from "~/item-authoring/fn/filterFn";

const itemFn = ({
	draft,
	id,
	title,
}: {
	readonly draft: boolean;
	readonly id: string;
	readonly title: string;
}) => ({
	...createDraftFn({
		draft,
		itemId: id,
		resourceId: `asset:${id}`,
		uid: `uid:${id}`,
	}),
	title,
});

describe("filterFn", () => {
	it("composes draft status and fuzzy query", () => {
		const matching = itemFn({
			draft: true,
			id: "item:draft-herb",
			title: "Draft Herb",
		});
		const items = [
			matching,
			itemFn({
				draft: false,
				id: "item:ready-herb",
				title: "Ready Herb",
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
		).toHaveLength(2);
	});
});
