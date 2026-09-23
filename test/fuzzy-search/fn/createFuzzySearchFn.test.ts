import { describe, expect, it } from "vitest";

import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

const candidate = (value: string, ...terms: string[]) => ({
	terms,
	value,
});

describe("createFuzzySearchFn", () => {
	it("uses deterministic Unicode casing to rank exact matches first", () => {
		const fuzzyFn = createFuzzySearchFn({
			candidates: [
				candidate("ascii", "ITEM"),
				candidate("dotted", "İTEM"),
			],
		});

		expect(fuzzyFn("i\u0307tem")).toEqual([
			"dotted",
			"ascii",
		]);
	});

	it("ranks equally matching direct terms above related terms and searches across both", () => {
		const fuzzyFn = createFuzzySearchFn({
			candidates: [
				{
					value: "related",
					terms: [
						"Workshop",
					],
					relatedTerms: [
						"Wood processing",
					],
				},
				{
					value: "direct",
					terms: [
						"Wood processing",
					],
					relatedTerms: [
						"Paper",
					],
				},
			],
		});
		expect(fuzzyFn("wood")).toEqual([
			"direct",
			"related",
		]);
		expect(fuzzyFn("wood processing")).toEqual([
			"direct",
			"related",
		]);
		expect(fuzzyFn("workshop wood")).toEqual([
			"related",
		]);
		expect(fuzzyFn("paper")).toEqual([
			"direct",
		]);
	});

	it("keeps exact matches first without hiding broader fuzzy matches", () => {
		const fuzzyFn = createFuzzySearchFn({
			candidates: [
				candidate("exact:first", "Bakery I Blueprint"),
				candidate("fuzzy", "Blueprint: Bakery I"),
				candidate("exact:second", " bakery i blueprint "),
			],
		});

		expect(fuzzyFn("  ")).toEqual([
			"exact:first",
			"fuzzy",
			"exact:second",
		]);
		expect(fuzzyFn("BAKERY I BLUEPRINT")).toEqual([
			"exact:first",
			"exact:second",
			"fuzzy",
		]);
	});

	it("requires every fuzzy query token while ignoring its word order", () => {
		const fuzzyFn = createFuzzySearchFn({
			candidates: [
				candidate("bio-waste-processor", "Bio-Waste Processor"),
				candidate("waste", "Waste"),
				candidate("processor", "Processor"),
			],
		});

		expect(fuzzyFn("was pro")).toEqual([
			"bio-waste-processor",
		]);
		expect(fuzzyFn("pro was")).toEqual([
			"bio-waste-processor",
		]);
		expect(fuzzyFn("was missing")).toEqual([]);
	});
});
