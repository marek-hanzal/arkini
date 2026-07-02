import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailGeneratedEffectsPanel } from "~/item-detail/ui/DetailGeneratedEffectsPanel";

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

	it("does not render a duplicate header count badge", () => {
		const html = renderToStaticMarkup(
			<DetailGeneratedEffectsPanel
				effects={[
					{
						grants: [],
						id: "effect:neutral-grant",
						name: "Neutral grant",
						polarity: "neutral",
						sourceScope: "both",
					},
				]}
			/>,
		);

		expect(html).toContain("Effects");
		expect(html).not.toContain("Provided effects");
		expect(html).not.toContain(">1</span>");
	});

	it("renders separate polarity sections without per-effect polarity pills", () => {
		const html = renderToStaticMarkup(
			<DetailGeneratedEffectsPanel
				effects={[
					{
						grants: [],
						id: "effect:buff",
						name: "Buff grant",
						polarity: "buff",
						sourceScope: "board",
					},
					{
						grants: [],
						id: "effect:neutral",
						name: "Neutral grant",
						polarity: "neutral",
						sourceScope: "both",
					},
				]}
			/>,
		);

		expect(html).toContain("Buff effects");
		expect(html).toContain("Neutral effects");
		expect(html).not.toContain(">Buffs<");
		expect(html).not.toContain(">Neutral<");
	});
});
