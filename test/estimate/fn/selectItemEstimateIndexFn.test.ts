import { describe, expect, it } from "vitest";

import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import { selectItemEstimateIndexFn } from "~/estimate/fn/selectItemEstimateIndexFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const item = (id: string, title: string) =>
	({
		description: `${title} description`,
		title,
		uid: id,
	}) as ItemSchema.Type;

const entries: ReadonlyArray<ItemEstimateIndexEntry> = [
	{
		demand: 0.05,
		itemUid: "bakery",
		method: "static",
		runtimeMs: 120_000,
		status: "complete",
	},
	{
		demand: 64_429.17,
		itemUid: "water",
		method: "static",
		runtimeMs: 0,
		status: "complete",
	},
	{
		demand: 50,
		itemUid: "well",
		method: "static",
		status: "partial",
	},
	{
		demand: 10,
		itemUid: "unused",
		method: "static",
		status: "unreachable",
	},
];

const items = [
	item("bakery", "Bakery"),
	item("water", "Water"),
	item("well", "Well"),
	item("unused", "Unused"),
];

const readItemUids = (view: "demand" | "fastest" | "incomplete" | "slowest", query = "") =>
	selectItemEstimateIndexFn({
		entries,
		items,
		query,
		view,
	}).map(({ item }) => item.uid);

describe("selectItemEstimateIndexFn", () => {
	it("owns the global Estimate ordering and keeps indeterminate estimates last", () => {
		expect(readItemUids("fastest")).toEqual([
			"water",
			"bakery",
			"unused",
			"well",
		]);
		expect(readItemUids("slowest")).toEqual([
			"bakery",
			"water",
			"unused",
			"well",
		]);
		expect(readItemUids("demand")).toEqual([
			"water",
			"well",
			"unused",
			"bakery",
		]);
	});

	it("applies the authored-item fuzzy query before ordering", () => {
		expect(readItemUids("demand", "wel")).toEqual([
			"well",
		]);
	});

	it("returns only partial and unreachable estimates without changing query semantics", () => {
		expect(readItemUids("incomplete")).toEqual([
			"unused",
			"well",
		]);
		expect(readItemUids("incomplete", "unus")).toEqual([
			"unused",
		]);
	});

	it("uses the item title as the stable numeric tie-break", () => {
		const tiedEntries = entries.map((entry) => ({
			...entry,
			demand: 1,
			runtimeMs: 1_000,
		}));
		const tiedItems = [
			item("bakery", "Zulu"),
			item("water", "Alpha"),
			item("well", "Middle"),
			item("unused", "Beta"),
		];

		expect(
			selectItemEstimateIndexFn({
				entries: tiedEntries,
				items: tiedItems,
				query: "",
				view: "fastest",
			}).map(({ item }) => item.uid),
		).toEqual([
			"water",
			"unused",
			"well",
			"bakery",
		]);
	});
});
