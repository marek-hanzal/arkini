import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemGeneratedEffectsCard } from "~/v0/item/ui/ItemGeneratedEffectsCard";

const createEffect = (
	overrides: Parameters<typeof ItemGeneratedEffectsCard>[0]["effects"][number],
) => overrides;

describe("ItemGeneratedEffectsCard", () => {
	it("groups generated effects by configured polarity", () => {
		const html = renderToStaticMarkup(
			<ItemGeneratedEffectsCard
				effects={[
					createEffect({
						grants: [
							{
								id: "grant:buff",
								summary: "Grants grant:buff.",
							},
						],
						id: "effect:buff",
						name: "Minor Haste",
						polarity: "buff",
						sourceScope: "board",
					}),
					createEffect({
						grants: [
							{
								id: "grant:debuff",
								summary: "Grants grant:debuff.",
							},
						],
						id: "effect:debuff",
						name: "Polluted Aura",
						polarity: "debuff",
						sourceScope: "board",
					}),
					createEffect({
						grants: [
							{
								id: "grant:neutral",
								summary: "Grants grant:neutral.",
							},
						],
						id: "effect:neutral",
						name: "Owned Town Hall",
						polarity: "neutral",
						sourceScope: "both",
					}),
					createEffect({
						grants: [
							{
								id: "grant:mixed",
								summary: "Grants grant:mixed.",
							},
						],
						id: "effect:mixed",
						name: "Overdrive",
						polarity: "mixed",
						sourceScope: "inventory",
					}),
				]}
			/>,
		);

		expect(html.indexOf("Buffs")).toBeLessThan(html.indexOf("Debuffs"));
		expect(html.indexOf("Debuffs")).toBeLessThan(html.indexOf("Neutral effects"));
		expect(html.indexOf("Neutral effects")).toBeLessThan(html.indexOf("Mixed effects"));
		expect(html).toContain("Minor Haste");
		expect(html).toContain("Polluted Aura");
		expect(html).toContain("Owned Town Hall");
		expect(html).toContain("Overdrive");
	});
});
