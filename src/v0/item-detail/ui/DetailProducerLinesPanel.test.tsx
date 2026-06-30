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

		expect(html.match(/data-ui="detail producer line separator"/g)?.length).toBe(1);
		expect(html).toContain("border-b border-violet-300/25");
		expect(html).toContain("gap-[0.9rem]");
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

	it("collapses a target-limited product line to the disabled action only", () => {
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
									quantity: 0,
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
		expect(html).not.toContain("Outputs");
		expect(html).not.toContain("Target limits");
		expect(html).not.toContain("Water");
		expect(html).not.toContain("Default");
	});

	it("hides required resources once a product line is ready to start", () => {
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
		expect(html).not.toContain("Water");
		expect(html).not.toContain("Withdraw");
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
									label: "Nearby producer:quarry-t1",
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
		expect(html).not.toContain("producer:quarry-t1");
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
