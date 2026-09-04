import { describe, expect, it } from "vitest";

import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";

describe("readSectionsFn", () => {
	it("hides charges and merges only for inventory items", () => {
		for (const mode of [
			"detail",
			"form",
		] as const) {
			const inventorySections = readSectionsFn(
				{
					type: "inventory",
				},
				mode,
			);
			expect(inventorySections.some(({ id }) => id === "charges")).toBe(false);
			expect(inventorySections.some(({ id }) => id === "merges")).toBe(false);
		}

		const simpleSections = readSectionsFn({
			type: "simple",
		});
		expect(simpleSections.some(({ id }) => id === "charges")).toBe(true);
		expect(simpleSections.some(({ id }) => id === "merges")).toBe(true);
	});
});
