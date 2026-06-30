import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { DetailHeroCard } from "~/v0/item-detail/ui/DetailHeroCard";

const createItem = (overrides: Partial<ViewItem> = {}): ViewItem => ({
	assetSrc: "townhall.svg",
	description: "Starter civic hub.",
	generatedEffects: [],
	id: "producer:town-hall-t1",
	maxStackSize: 10,
	name: "Town Hall I",
	storage: "both",
	tags: [
		"producer",
	],
	...overrides,
});

describe("DetailHeroCard", () => {
	it("does not render the inventory-placement storage badge", () => {
		const html = renderToStaticMarkup(<DetailHeroCard item={createItem()} />);

		expect(html).toContain("Town Hall I");
		expect(html).toContain("Stack 10");
		expect(html).not.toContain(">both<");
	});
});
