import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import { selectEditorItemEstimateIndexFx } from "~/editor/selectEditorItemEstimateIndexFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

const item = (id: string, title: string) =>
	({
		description: `${title} description`,
		id,
		title,
		type: "simple",
		uid: id,
	}) as ItemSchema.Type;

const entries: ReadonlyArray<EditorItemEstimateIndexEntry> = [
	{
		demand: 0.05,
		itemId: "bakery",
		method: "static",
		runtimeMs: 120_000,
		status: "complete",
	},
	{
		demand: 64_429.17,
		itemId: "water",
		method: "static",
		runtimeMs: 0,
		status: "complete",
	},
	{
		demand: 50,
		itemId: "well",
		method: "static",
		status: "partial",
	},
];

const items = [
	item("bakery", "Bakery"),
	item("water", "Water"),
	item("well", "Well"),
];

const readItemIds = (sort: "demand" | "fastest" | "slowest", query = "") =>
	Effect.runSync(
		selectEditorItemEstimateIndexFx({
			entries,
			items,
			query,
			sort,
		}),
	).map(({ item }) => item.id);

describe("selectEditorItemEstimateIndexFx", () => {
	it("owns the global Estimate ordering and keeps indeterminate estimates last", () => {
		expect(readItemIds("fastest")).toEqual([
			"water",
			"bakery",
			"well",
		]);
		expect(readItemIds("slowest")).toEqual([
			"bakery",
			"water",
			"well",
		]);
		expect(readItemIds("demand")).toEqual([
			"water",
			"well",
			"bakery",
		]);
	});

	it("applies the editor fuzzy query before ordering", () => {
		expect(readItemIds("demand", "wel")).toEqual([
			"well",
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
		];

		expect(
			Effect.runSync(
				selectEditorItemEstimateIndexFx({
					entries: tiedEntries,
					items: tiedItems,
					query: "",
					sort: "fastest",
				}),
			).map(({ item }) => item.id),
		).toEqual([
			"water",
			"well",
			"bakery",
		]);
	});
});
