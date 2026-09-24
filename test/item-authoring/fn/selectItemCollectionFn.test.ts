import { describe, expect, it } from "vitest";

import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const itemFn = (id: string, title: string) =>
	({
		uid: id,
		title,
	}) as ItemSchema.Type;
const alpha = itemFn("alpha", "Alpha ore");
const beta = itemFn("beta", "Beta ore");
const gamma = itemFn("gamma", "Gamma ore");
const fresh = itemFn("fresh", "Fresh");
const items = [
	fresh,
	gamma,
	alpha,
	beta,
];

describe("selectItemCollectionFn", () => {
	it("filters notes by stable item UID and combines them with search", () => {
		const notedItemUids = new Set([
			beta.uid,
			gamma.uid,
			fresh.uid,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids,
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
				query: "ore",
				view: "with-note",
			}),
		).toEqual([
			beta,
			gamma,
		]);
	});
});
