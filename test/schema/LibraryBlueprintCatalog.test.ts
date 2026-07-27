import { describe, expect, it } from "vitest";

import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const EraNumberByTag = {
	"era:I": 1,
	"era:II": 2,
	"era:III": 3,
	"era:IV": 4,
	"era:V": 5,
	"era:VI": 6,
	"era:VII": 7,
	"era:VIII": 8,
	"era:IX": 9,
	"era:X": 10,
	"era:XI": 11,
} as const;

const CatalogEraByLibraryId = {
	"producer:library-t1": 2,
	"producer:library-t2": 4,
	"producer:library-t3": 8,
	"producer:library-t4": 11,
} as const;

describe("Library blueprint catalog", () => {
	it.each(
		Object.entries(CatalogEraByLibraryId),
	)("%s reissues every blueprint from its era and all previous eras", async (libraryId, catalogEra) => {
		const config = await readArkiniGameConfigSource();
		const expectedBlueprintIds = Object.values(config.items)
			.filter((item) => {
				if (item.type !== "blueprint") return false;
				const eraTag = item.tags.find(
					(tag): tag is keyof typeof EraNumberByTag => tag in EraNumberByTag,
				);

				return eraTag !== undefined && EraNumberByTag[eraTag] <= catalogEra;
			})
			.map((item) => item.id)
			.sort();
		const library = config.items[libraryId];

		expect(library?.type).toBe("producer");
		if (library?.type !== "producer") return;

		const actualBlueprintIds = library.lines
			.flatMap((line) => line.output?.set ?? [])
			.flatMap((set) => set.roll)
			.flatMap((roll) => (roll.type === "guaranteed" ? roll.drop : []))
			.map((drop) => drop.itemId)
			.filter((itemId) => itemId.startsWith("item:blueprint-"))
			.sort();

		expect(actualBlueprintIds).toEqual(expectedBlueprintIds);
		expect(new Set(actualBlueprintIds).size).toBe(actualBlueprintIds.length);
	});
});
