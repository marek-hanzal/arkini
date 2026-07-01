import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readDetailProducerLineControl } from "~/v0/item-detail/control/readDetailProducerLineControl";
import { DetailProducerLinesPanel } from "~/v0/item-detail/ui/DetailProducerLinesPanel";

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
	"item:grain": item("item:grain", "Grain", "grain.svg"),
	"item:tree": item("item:tree", "Tree", "tree.svg"),
	"item:water": item("item:water", "Water", "water.svg"),
	"producer:quarry-t1": item("producer:quarry-t1", "Quarry I", "quarry.svg"),
};

const lineModel = (line: ProducerProductLineView) => ({
	control: readDetailProducerLineControl({
		canSetDefault: true,
		line,
		onSetDefault: () => undefined,
		onStart: () => undefined,
		onWithdrawInput: () => undefined,
		pending: false,
	}),
	line,
});

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	durationMs: 5000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	lineKind: "product",
	name: "Grain",
	producerQueuedJobs: 0,
	productId: "product:farm:grain",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
	...overrides,
});

describe("DetailProducerLinesPanel", () => {
	it("renders product lines without an extra nested card shell", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							outputs: [
								{
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 0,
									quantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain('<article class="min-w-0">');
		expect(html).not.toContain(
			"rounded-sm bg-ak-surface-soft p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]",
		);
	});

	it("renders separators between product lines only", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							name: "Grain",
							productId: "product:farm:grain",
						}),
					),
					lineModel(
						createLine({
							name: "Water",
							productId: "product:farm:water",
						}),
					),
				]}
			/>,
		);

		expect(html.match(/data-ui="detail separator"/g)?.length).toBe(1);
		expect(html).toContain("border-t border-violet-300/18");
		expect(html).toContain("gap-4");
	});

	it("does not render a duplicate header count badge", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(createLine()),
				]}
			/>,
		);

		expect(html).toContain("Lines");
		expect(html).not.toContain("Product lines");
		expect(html).not.toContain(">1</span>");
	});

	it("keeps product-line icons only in outputs, not duplicated in the header", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							outputs: [
								{
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 7,
									quantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Outputs");
		expect(html.match(/<img[^>]+src="grain\.svg"/g)?.length).toBe(1);
	});

	it("renders disabled guaranteed outputs as zero chance, not guaranteed", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							outputs: [
								{
									enabled: false,
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 0,
									probability: 0,
									quantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("disabled · 1× · 0% chance");
		expect(html).not.toContain("disabled · 1× · guaranteed");
	});

	it("renders weighted output odds per roll instead of hiding runtime odds", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							outputs: [
								{
									enabled: false,
									itemId: "item:grain",
									kind: "weighted",
									ownedQuantity: 0,
									probability: 0,
									quantity: 1,
									rollLabel: "weighted roll",
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("disabled · 1× · 0%/roll · weighted roll");
		expect(html).not.toContain("disabled · 1× · weighted roll");
	});

	it("renders faster duration multipliers instead of hiding speedups", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							durationMs: 45000,
							effectDurationMultiplier: 0.75,
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("faster 0.75×");
	});

	it("renders already enriched active bonus summaries", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							effectBonusLines: [
								"Nearby Tree enables production: 10% faster production.",
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Nearby Tree enables production");
	});

	it("hides fulfilled effect requirements and the parent requirement box", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							effectRequirements: [
								{
									kind: "grant.require",
									label: "Owns Water",
									ready: true,
								},
							],
							inputsReady: false,
							inputs: [
								{
									available: 1,
									capacity: 1,
									consume: true,
									itemId: "item:water",
									quantity: 1,
									stored: 0,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).not.toContain("Owns Water");
		expect(html).not.toContain("Missing effects");
		expect(html).not.toContain("Blocked effects");
		expect(html).toContain("Water");
	});

	it("keeps target-limited product line details visible beside the disabled action", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							inputItemIds: [
								"item:water",
							],
							inputs: [
								{
									available: 1,
									capacity: 1,
									consume: true,
									itemId: "item:water",
									quantity: 1,
									stored: 0,
								},
							],
							inputsAvailable: true,
							inputsReady: false,
							name: "Blueprint: Library I",
							outputLimitBlocked: true,
							outputs: [
								{
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 1,
									quantity: 1,
								},
							],
							targetLimits: [
								{
									itemId: "item:grain",
									maxCount: 1,
									ownedQuantity: 1,
									remainingQuantity: 0,
									requiredQuantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Blueprint: Library I");
		expect(html).toContain("Limit reached");
		expect(html).toContain("Outputs");
		expect(html).toContain("Target limits");
		expect(html).toContain("Water");
		expect(html).toContain("Default");
	});

	it("keeps fulfilled resources visible until a product line starts running", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							inputItemIds: [
								"item:water",
							],
							inputs: [
								{
									available: 0,
									capacity: 1,
									consume: true,
									itemId: "item:water",
									quantity: 1,
									stored: 1,
								},
							],
							inputsAvailable: true,
							inputsReady: true,
							outputs: [
								{
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 0,
									quantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Start");
		expect(html).toContain("Outputs");
		expect(html).toContain("Water");
		expect(html).toContain("Withdraw");
		expect(html).toContain("1/1");
	});

	it("uses short default labels and missing-item copy", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							inputItemIds: [
								"item:water",
							],
							inputs: [
								{
									available: 0,
									capacity: 1,
									consume: true,
									itemId: "item:water",
									quantity: 1,
									stored: 0,
								},
							],
							inputsAvailable: false,
							inputsReady: false,
							isDefault: true,
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Missing items");
		expect(html).toContain(">Un-default<");
		expect(html).not.toContain("Feed items by drag");
		expect(html).not.toContain("Default product");
	});

	it("renders missing effect requirements before outputs and resource inputs", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							effectRequirements: [
								{
									kind: "nearby.require",
									label: "Nearby Quarry I",
									ready: false,
								},
							],
							inputItemIds: [
								"item:water",
							],
							inputs: [
								{
									available: 0,
									capacity: 1,
									consume: true,
									itemId: "item:water",
									quantity: 1,
									stored: 0,
								},
							],
							inputsAvailable: false,
							inputsReady: false,
							outputs: [
								{
									itemId: "item:grain",
									kind: "guaranteed",
									ownedQuantity: 0,
									quantity: 1,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Missing effects");
		expect(html).toContain("Missing Nearby Quarry I");
		expect(html.indexOf("Missing effects")).toBeLessThan(html.indexOf("Outputs"));
		expect(html.indexOf("Missing effects")).toBeLessThan(html.indexOf("Water"));
	});

	it("shows active blockers as blocked effects", () => {
		const html = renderToStaticMarkup(
			<DetailProducerLinesPanel
				items={items}
				lines={[
					lineModel(
						createLine({
							blocked: true,
							effectRequirements: [
								{
									kind: "grant.blockStart",
									label: "Engineers path chosen",
									ready: false,
								},
							],
						}),
					),
				]}
			/>,
		);

		expect(html).toContain("Blocked effects");
		expect(html).toContain("Blocked by Engineers path chosen");
	});
});
