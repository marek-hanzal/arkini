import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { ItemCraftCard } from "~/v0/item/ui/ItemCraftCard";

const createCraft = (overrides: Partial<CraftProgressView> = {}): CraftProgressView => ({
	acceptedInputItemIds: [],
	canAcceptInputs: false,
	complete: false,
	delivered: {},
	durationMs: 1000,
	id: "item:craft-table",
	inputProgress: 1,
	inputs: [],
	phase: "waiting",
	progress: 0.5,
	readyAtMs: 1000,
	remainingMs: 500,
	resultItemId: "item:plank",
	startAtMs: 0,
	timeProgress: 0.5,
	...overrides,
});

describe("ItemCraftCard", () => {
	it("shows blocked craft delivery instead of running", () => {
		const html = renderToStaticMarkup(
			<ItemCraftCard
				craft={createCraft({
					deliveryBlocked: true,
					phase: "delivery_blocked",
					progress: 0,
					timeProgress: 1,
				})}
				items={{}}
				pending={false}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Delivery blocked");
		expect(html).not.toContain("Running");
	});

	it("uses shared craft run state for available auto-fill inputs", () => {
		const html = renderToStaticMarkup(
			<ItemCraftCard
				craft={createCraft({
					acceptedInputItemIds: [
						"item:twig",
					],
					canAcceptInputs: true,
					inputProgress: 0,
					inputs: [
						{
							available: 1,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					phase: "collecting_inputs",
					progress: 0,
					readyAtMs: undefined,
					startAtMs: undefined,
					timeProgress: 0,
				})}
				items={{}}
				pending={false}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Auto-fill inputs</button>");
		expect(html).not.toContain('disabled=""');
	});
});
