import { describe, expect, it } from "vitest";

import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const itemFn = (id: string, title: string, draft = false) =>
	({
		uid: id,
		title,
		draft,
	}) as ItemSchema.Type;
const alpha = itemFn("alpha", "Alpha ore", true);
const beta = itemFn("beta", "Beta ore", true);
const gamma = itemFn("gamma", "Gamma ore");
const fresh = itemFn("fresh", "Fresh", true);
const items = [
	fresh,
	gamma,
	alpha,
	beta,
];

describe("selectItemCollectionFn", () => {
	it("filters notes by stable item UID and combines them with drafts and search", () => {
		const notedItemUids = new Set([
			beta.uid,
			gamma.uid,
			fresh.uid,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids,
				draft: false,
				query: "",
				view: "with-note",
			}),
		).toEqual([
			beta,
			fresh,
			gamma,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids,
				draft: true,
				query: "ore",
				view: "with-note",
			}),
		).toEqual([
			beta,
		]);
	});
});
