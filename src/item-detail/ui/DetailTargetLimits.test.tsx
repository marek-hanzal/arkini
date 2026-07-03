import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { DetailTargetLimits } from "~/item-detail/ui/DetailTargetLimits";

const items: ItemCatalogView = {
	"producer:lumberjack-t1": {
		assets: [],
		description: "Lumberjack I",
		generatedEffects: [],
		id: "producer:lumberjack-t1",
		maxStackSize: 1,
		name: "Lumberjack I",
		storage: "both",
		tags: [],
	},
};

describe("DetailTargetLimits", () => {
	it("keeps the target name on the left and the count in a dedicated right-side node", () => {
		const html = renderToStaticMarkup(
			<DetailTargetLimits
				id="line:blueprint:lumberjack-t1"
				items={items}
				limits={[
					{
						itemId: "producer:lumberjack-t1",
						maxCount: 4,
						ownedQuantity: 1,
						remainingQuantity: 3,
						requiredQuantity: 1,
					},
				]}
			/>,
		);

		expect(html).toContain('data-ui="target limit name"');
		expect(html).toContain('data-ui="target limit count"');
		expect(html).toContain("Lumberjack I");
		expect(html).toContain(">1<span");
		expect(html).toContain(">/4</span>");
		expect(html).not.toContain("Lumberjack I 1/4");
	});

	it("marks exhausted limits without hiding their count", () => {
		const html = renderToStaticMarkup(
			<DetailTargetLimits
				id="line:blueprint:lumberjack-t1"
				items={items}
				limits={[
					{
						itemId: "producer:lumberjack-t1",
						maxCount: 4,
						ownedQuantity: 4,
						remainingQuantity: 0,
						requiredQuantity: 1,
					},
				]}
			/>,
		);

		expect(html).toContain("Limit reached");
		expect(html).toContain(">4<span");
		expect(html).toContain(">/4</span>");
	});
});
