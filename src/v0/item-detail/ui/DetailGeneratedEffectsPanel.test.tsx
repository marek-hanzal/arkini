import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailGeneratedEffectsPanel } from "~/v0/item-detail/ui/DetailGeneratedEffectsPanel";

describe("DetailGeneratedEffectsPanel", () => {
	it("renders authored grant names instead of raw grant ids", () => {
		const html = renderToStaticMarkup(
			<DetailGeneratedEffectsPanel
				effects={[
					{
						grants: [
							{
								id: "grant:owned:producer:quarry-t1",
								name: "Owns Quarry I",
							},
						],
						id: "effect:grant-owned:producer-quarry-t1",
						name: "Owned Quarry I grant",
						polarity: "neutral",
						sourceScope: "both",
					},
				]}
			/>,
		);

		expect(html).toContain("Owns Quarry I");
		expect(html).not.toContain("grant:owned:producer:quarry-t1");
	});
});
