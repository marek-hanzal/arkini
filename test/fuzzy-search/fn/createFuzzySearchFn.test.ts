import { describe, expect, it } from "vitest";

import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

const candidate = (value: string, ...terms: string[]) => ({
	terms,
	value,
});

describe("createFuzzySearchFn", () => {
	it("owns empty, exact, and fuzzy query handling in caller order", () => {
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
