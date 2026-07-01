import { describe, expect, it } from "vitest";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readDetailEffectRequirementLabel } from "~/v0/item-detail/ui/readDetailEffectRequirementLabel";

const item = (id: string, name: string) => ({
	assetSrc: `${id}.svg`,
	description: name,
	generatedEffects: [],
	id,
	maxStackSize: 99,
	name,
	storage: "both" as const,
	tags: [],
});

const items: ItemCatalogView = {
	"item:cheat:speed-enable": item("item:cheat:speed-enable", "Speed Enable"),
	"item:tree": item("item:tree", "Tree"),
	"producer:lumberjack-t1": item("producer:lumberjack-t1", "Lumberjack I"),
};

describe("readDetailEffectRequirementLabel", () => {
	it("replaces item and producer ids with catalog names", () => {
		expect(
			readDetailEffectRequirementLabel({
				items,
				label: "Nearby item:tree enables producer:lumberjack-t1",
			}),
		).toBe("Nearby Tree enables Lumberjack I");
	});

	it("does not swallow punctuation after an id", () => {
		expect(
			readDetailEffectRequirementLabel({
				items,
				label: "Nearby item:tree: requirement met",
			}),
		).toBe("Nearby Tree: requirement met");
	});

	it("supports nested colon ids", () => {
		expect(
			readDetailEffectRequirementLabel({
				items,
				label: "Uses item:cheat:speed-enable.",
			}),
		).toBe("Uses Speed Enable.");
	});
});
