import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readDetailCraftControl } from "~/v0/item-detail/control/readDetailCraftControl";
import { DetailCraftPanel } from "~/v0/item-detail/ui/DetailCraftPanel";

const item = (id: string, name: string, assetSrc: string) => ({
	assets: [
		{
			src: assetSrc,
		},
	],
	description: name,
	generatedEffects: [],
	id,
	maxStackSize: 99,
	name,
	storage: "both" as const,
	tags: [],
});

const items: ItemCatalogView = {
	"item:plank": item("item:plank", "Plank", "plank.svg"),
	"item:tree": item("item:tree", "Tree", "tree.svg"),
	"item:water": item("item:water", "Water", "water.svg"),
};

const createCraft = (overrides: Partial<CraftProgressView> = {}): CraftProgressView => ({
	acceptedInputItemIds: [
		"item:water",
	],
	canAcceptInputs: true,
	complete: false,
	delivered: {},
	durationMs: 1000,
	id: "craft:plank",
	inputProgress: 0,
	inputs: [
		{
			available: 1,
			itemId: "item:water",
			quantity: 1,
		},
	],
	phase: "collecting_inputs",
	progress: 0,
	resultItemId: "item:plank",
	startRequirementsReady: true,
	timeProgress: 0,
	...overrides,
});

const renderCraft = (craft: CraftProgressView) =>
	renderToStaticMarkup(
		<DetailCraftPanel
			control={readDetailCraftControl({
				craft,
				onClaim: () => undefined,
				onStart: () => undefined,
				onWithdrawInput: () => undefined,
				pending: false,
			})}
			craft={craft}
			items={items}
		/>,
	);

describe("DetailCraftPanel", () => {
	it("keeps required resources visible while inputs are still being collected", () => {
		const html = renderCraft(createCraft());

		expect(html).toContain("Water");
		expect(html).toContain("0/1");
		expect(html).toContain("Auto-fill inputs");
	});

	it("renders already enriched effect block reasons", () => {
		const html = renderCraft(
			createCraft({
				effectBlockReasons: [
					"Nearby Tree blocks crafting",
				],
				effectBlocked: true,
			}),
		);

		expect(html).toContain("Nearby Tree blocks crafting");
	});

	it("keeps fulfilled resources visible until the craft starts running", () => {
		const html = renderCraft(
			createCraft({
				delivered: {
					"item:water": 1,
				},
				inputProgress: 1,
				progress: 1,
			}),
		);

		expect(html).toContain("Start craft");
		expect(html).toContain("Water");
		expect(html).toContain("Withdraw");
		expect(html).toContain("1/1");
	});

	it("hides required resources while the craft is running", () => {
		const html = renderCraft(
			createCraft({
				acceptedInputItemIds: [],
				canAcceptInputs: false,
				delivered: {
					"item:water": 1,
				},
				inputProgress: 1,
				phase: "waiting",
				progress: 0.5,
				readyAtMs: 2000,
				remainingMs: 500,
				startAtMs: 1000,
				timeProgress: 0.5,
			}),
		);

		expect(html).toContain("Running");
		expect(html).not.toContain("Water");
	});
});
