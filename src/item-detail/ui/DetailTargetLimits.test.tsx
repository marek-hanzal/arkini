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
	it("renders unique limits as a compact badge without repeating the target name", () => {
		const html = renderToStaticMarkup(
			<DetailTargetLimits
				id="line:blueprint:lumberjack-t1"
				items={items}
				limits={[
					{
						itemId: "producer:lumberjack-t1",
						maxCount: 1,
						ownedQuantity: 0,
						remainingQuantity: 1,
						requiredQuantity: 1,
					},
				]}
			/>,
		);

		expect(html).toContain('data-ui="target limit badge"');
		expect(html).toContain("Unique");
		expect(html).not.toContain("Target limits");
		expect(html).not.toContain("Lumberjack I");
		expect(html).not.toContain(">0/1<");
	});

	it("renders multi-count limits as one concise count badge", () => {
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

		expect(html).toContain("Limit 1/4");
		expect(html).not.toContain("Lumberjack I");
		expect(html).not.toContain("Limit reached");
	});

	it("keeps exhausted limits highlighted without adding extra copy", () => {
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

		expect(html).toContain("Limit 4/4");
		expect(html).toContain("border-rose-300/40");
		expect(html).not.toContain("Limit reached");
	});
});
