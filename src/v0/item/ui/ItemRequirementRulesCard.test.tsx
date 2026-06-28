import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import { ItemRequirementRulesCard } from "~/v0/item/ui/ItemRequirementRulesCard";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";

const items: ItemCatalogView = {
	"item:done": {
		assetSrc: "done.svg",
		description: "Done requirement",
		generatedEffects: [],
		id: "item:done",
		maxStackSize: 1,
		name: "Done requirement",
		storage: "both",
		tags: [],
	},
	"item:missing": {
		assetSrc: "missing.svg",
		description: "Missing requirement",
		generatedEffects: [],
		id: "item:missing",
		maxStackSize: 1,
		name: "Missing requirement",
		storage: "both",
		tags: [],
	},
};

type PassiveRequirement = Extract<
	ActivationRequirementView,
	{
		type: "passive";
	}
>;

const passiveRequirement = (overrides: Partial<PassiveRequirement> = {}): PassiveRequirement => ({
	capacity: 1,
	itemId: "item:done",
	quantity: 1,
	stored: 1,
	type: "passive",
	...overrides,
});

describe("ItemRequirementRulesCard", () => {
	it("hides satisfied expectation rows by default", () => {
		const html = renderToStaticMarkup(
			<ItemRequirementRulesCard
				items={items}
				requirements={[
					passiveRequirement(),
					passiveRequirement({
						itemId: "item:missing",
						stored: 0,
					}),
				]}
				title="Craft rules"
			/>,
		);

		expect(html).not.toContain("Done requirement");
		expect(html).toContain("Missing requirement");
	});

	it("removes the whole section when every expectation is satisfied", () => {
		const html = renderToStaticMarkup(
			<ItemRequirementRulesCard
				items={items}
				requirements={[
					passiveRequirement(),
				]}
				title="Craft rules"
			/>,
		);

		expect(html).toBe("");
	});

	it("can still render satisfied rows for diagnostics", () => {
		const html = renderToStaticMarkup(
			<ItemRequirementRulesCard
				hideSatisfied={false}
				items={items}
				requirements={[
					passiveRequirement(),
				]}
				title="Craft rules"
			/>,
		);

		expect(html).toContain("Done requirement");
	});
});
