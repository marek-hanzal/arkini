import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { DetailDropsPanel } from "~/v0/item-detail/ui/DetailDropsPanel";

const item = (id: string, name: string, assetSrc: string) => ({
	assetSrc,
	description: name,
	generatedEffects: [],
	id,
	maxStackSize: 99,
	name,
	storage: "both" as const,
	tags: [],
});

const items: ItemCatalogView = {
	"item:log": item("item:log", "Log", "log.svg"),
	"item:tree": item("item:tree", "Tree", "tree.svg"),
};

describe("DetailDropsPanel", () => {
	it("renders already enriched drop effect labels", () => {
		const html = renderToStaticMarkup(
			<DetailDropsPanel
				items={items}
				drops={[
					{
						chanceLabel: "100%",
						effects: [
							{
								active: true,
								impact: "availability",
								kind: "nearby.require",
								label: "Nearby Tree",
								ready: true,
								result: "requirement met",
							},
						],
						itemId: "item:log",
						quantityLabel: "1",
					},
				]}
			/>,
		);

		expect(html).toContain("Nearby Tree");
	});
});
