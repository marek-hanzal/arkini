import { describe, expect, it } from "vitest";

import { searchFn } from "~/item-authoring/fn/searchFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const item = (id: string, title: string) =>
	({
		description: `${title} description`,
		id,
		title,
		type: "simple",
		uid: id,
	}) as ItemSchema.Type;

describe("searchFn", () => {
	it("uses deterministic Unicode casing for exact matches", () => {
		const dottedUppercaseI = item("dotted", "İTEM");
		const ascii = item("ascii", "ITEM");

		expect(
			searchFn(
				[
					ascii,
					dottedUppercaseI,
				],
				"i\u0307tem",
			),
		).toEqual([
			dottedUppercaseI,
		]);
	});

	it("requires every fuzzy query token while ignoring its word order", () => {
		const bioWasteProcessor = item("item:bio-waste-processor", "Bio-Waste Processor");
		const waste = item("item:waste", "Waste");
		const processor = item("item:processor", "Processor");
		const items = [
			waste,
			processor,
			bioWasteProcessor,
		];

		expect(searchFn(items, "was pro")).toEqual([
			bioWasteProcessor,
		]);
		expect(searchFn(items, "pro was")).toEqual([
			bioWasteProcessor,
		]);
		expect(searchFn(items, "was missing")).toEqual([]);
	});
});
