import { describe, expect, it } from "vitest";

import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemEstimateIndexRow } from "~/estimate/type/ItemEstimateIndex";

const itemFn = (id: string, title: string, draft = false) =>
	({
		uid: id,
		title,
		draft,
	}) as ItemSchema.Type;
const rowFn = (
	item: ItemSchema.Type,
	status: "complete" | "partial" | "unreachable" = "complete",
): ItemEstimateIndexRow => ({
	item,
	estimate: {
		itemUid: item.uid,
		status,
		method: "static",
		demand: 1,
		runtimeMs: 1000,
	},
});

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
	it("combines draft/search with canonical ranking without hiding items awaiting estimates", () => {
		const orderedEstimates = [
			rowFn(gamma),
			rowFn(beta),
			rowFn(alpha),
		];
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates,
				query: "ore",
				draft: true,
				view: "demand",
			}),
		).toEqual([
			beta,
			alpha,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates,
				query: "",
				draft: false,
				view: "fastest",
			}),
		).toEqual([
			gamma,
			beta,
			alpha,
			fresh,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates: [],
				query: "",
				draft: false,
				view: "fastest",
			}),
		).toEqual([
			alpha,
			beta,
			fresh,
			gamma,
		]);
		expect(items).toEqual([
			fresh,
			gamma,
			alpha,
			beta,
		]);
	});

	it("does not mistake missing estimates for incomplete paths and retains exact-ID search", () => {
		const orderedEstimates = [
			rowFn(alpha),
			rowFn(beta, "partial"),
			rowFn(gamma, "unreachable"),
		];
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates,
				query: "ore",
				draft: true,
				view: "incomplete",
			}),
		).toEqual([
			beta,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates,
				query: "",
				draft: false,
				view: "incomplete",
			}),
		).toEqual([
			beta,
			gamma,
		]);
		expect(
			selectItemCollectionFn({
				items,
				notedItemUids: new Set(),
				orderedEstimates,
				query: "beta",
				draft: true,
				view: "name",
			})[0],
		).toBe(beta);
	});
	it("filters notes by stable item UID and combines them with drafts and search", () => {
		const notedItemUids = new Set([
			beta.uid,
			gamma.uid,
			fresh.uid,
		]);
		expect(
			selectItemCollectionFn({
				items,
				orderedEstimates: [],
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
				orderedEstimates: [],
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
