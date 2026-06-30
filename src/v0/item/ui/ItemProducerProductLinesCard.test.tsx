import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemProducerProductLinesCard } from "~/v0/item/ui/ItemProducerProductLinesCard";

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	durationMs: 5000,
	inProgress: true,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: true,
	name: "Log",
	lineKind: "product" as const,
	pausedAtMs: 1000,
	producerQueuedJobs: 1,
	productId: "product:lumberjack-t1:log",
	progress: 0.2,
	remainingMs: 4000,
	queueFull: true,
	queuedJobs: 1,
	queueSize: 1,
	readyAtMs: 5000,
	startAtMs: 0,
	...overrides,
});

describe("ItemProducerProductLinesCard", () => {
	it("shows product output ownership with the output icon", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{
					"item:grain": {
						assetSrc: "grain.svg",
						description: "Grain",
						generatedEffects: [],
						id: "item:grain",
						maxStackSize: 99,
						name: "Grain",
						storage: "both",
						tags: [],
					},
				}}
				lines={[
					createLine({
						name: "Grain",
						outputs: [
							{
								itemId: "item:grain",
								ownedQuantity: 7,
							},
						],
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Owned 7");
		expect(html).toContain("grain.svg");
	});

	it("shows every potential product-line output with chance and quantity metadata", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{
					"item:pollution": {
						assetSrc: "pollution.svg",
						description: "Pollution",
						generatedEffects: [],
						id: "item:pollution",
						maxStackSize: 99,
						name: "Pollution",
						storage: "board",
						tags: [],
					},
					"item:trash": {
						assetSrc: "trash.svg",
						description: "Trash",
						generatedEffects: [],
						id: "item:trash",
						maxStackSize: 99,
						name: "Trash",
						storage: "both",
						tags: [],
					},
				}}
				lines={[
					createLine({
						name: "Burn Trash",
						outputs: [
							{
								itemId: "item:trash",
								kind: "guaranteed",
								ownedQuantity: 4,
								quantity: 2,
							},
							{
								itemId: "item:pollution",
								kind: "chance",
								ownedQuantity: 0,
								probability: 0.25,
								quantity: 1,
							},
						],
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Outputs");
		expect(html).toContain("Trash");
		expect(html).toContain("2× · guaranteed · Owned 4");
		expect(html).toContain("Pollution");
		expect(html).toContain("25% chance");
		expect(html).toContain("pollution.svg");
	});

	it("shows paused producer jobs with frozen remaining time", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine(),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Paused · 4s");
		expect(html).toContain("--ui-progress-button-start:0.2");
		expect(html).toContain("transform:scaleX(0.2)");
		expect(html).not.toContain("ui-progress-button-fill-to-end");
		expect(html).not.toContain("Queue full</span></button>");
		expect(html).not.toContain("mt-2 h-1.5 overflow-hidden");
	});

	it("lets running producer button fill complete to the end between runtime samples", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						pausedAtMs: undefined,
						remainingMs: 800,
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Running · 1s");
		expect(html).toContain("--ui-progress-button-start:0.2");
		expect(html).toContain("animation:ui-progress-button-fill-to-end 800ms linear forwards");
		expect(html).toContain("transform:scaleX(0.2)");
	});

	it("counts active effect progress down in the action button", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						lineKind: "effect" as const,
						name: "Minor Haste",
						pausedAtMs: undefined,
						remainingMs: 800,
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Active · 1s");
		expect(html).toContain("--ui-progress-button-start:0.8");
		expect(html).toContain("animation:ui-progress-button-empty-to-start 800ms linear forwards");
		expect(html).toContain("transform:scaleX(0.8)");
		expect(html).not.toContain("ui-progress-button-fill-to-end");
	});

	it("groups effect lines by configured polarity", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						effectPolarity: "debuff",
						lineKind: "effect" as const,
						name: "Smoke Cloud",
						productId: "product:effect:smoke",
					}),
					createLine({
						effectPolarity: "buff",
						lineKind: "effect" as const,
						name: "Minor Haste",
						productId: "product:effect:haste",
					}),
					createLine({
						effectPolarity: "mixed",
						lineKind: "effect" as const,
						name: "Overdrive",
						productId: "product:effect:overdrive",
					}),
					createLine({
						effectPolarity: "neutral",
						lineKind: "effect" as const,
						name: "Path Choice",
						productId: "product:effect:path",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html.indexOf("Buffs")).toBeLessThan(html.indexOf("Debuffs"));
		expect(html.indexOf("Debuffs")).toBeLessThan(html.indexOf("Neutral effects"));
		expect(html.indexOf("Neutral effects")).toBeLessThan(html.indexOf("Mixed effects"));
		expect(html).toContain("Buff");
		expect(html).toContain("Debuff");
		expect(html).toContain("Neutral");
		expect(html).toContain("Mixed");
	});

	it("shows effect benefits before the offering inputs", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{
					"item:water": {
						assetSrc: "water.svg",
						description: "Water",
						generatedEffects: [],
						id: "item:water",
						maxStackSize: 99,
						name: "Water",
						storage: "both",
						tags: [],
					},
				}}
				lines={[
					createLine({
						effectBenefits: [
							"25% faster production for Grain, Log, Stone, Plank, Vegetables, Water.",
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
						lineKind: "effect" as const,
						name: "Minor Haste",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Benefit");
		expect(html).toContain(
			"25% faster production for Grain, Log, Stone, Plank, Vegetables, Water.",
		);
		expect(html.indexOf("Benefit")).toBeLessThan(html.indexOf("Water"));
	});

	it("shows active effect bonuses on affected product lines", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						effectBonusLines: [
							"Bountiful Offering: 35% chance for +1× Log.",
						],
						lineKind: "product" as const,
						name: "Log",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Active bonus");
		expect(html).toContain("Bountiful Offering: 35% chance for +1× Log.");
	});

	it("labels active block-start effects as blockers instead of missing requirements", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						blocked: true,
						effectRequirements: [
							{
								kind: "grant.blockStart",
								label: "Engineers path chosen",
								ready: false,
							},
						],
						name: "Cathedral Blueprint",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Blocked Engineers path chosen");
		expect(html).not.toContain("Missing Engineers path chosen");
	});

	it("labels inactive block-start effects as not blocked", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						effectRequirements: [
							{
								kind: "grant.blockStart",
								label: "Engineers path chosen",
								ready: true,
							},
						],
						name: "Cathedral Blueprint",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Not blocked by Engineers path chosen");
		expect(html).not.toContain("✓ Engineers path chosen");
		expect(html).not.toContain("Blocked Engineers path chosen");
	});

	it("labels product and effect default slots separately", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						isDefault: true,
						lineKind: "product" as const,
						name: "Log",
						productId: "product:log",
					}),
					createLine({
						effectPolarity: "buff",
						isDefault: true,
						lineKind: "effect" as const,
						name: "Minor Haste",
						productId: "product:effect:minor-haste",
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Default product");
		expect(html).toContain("Default effect");
		expect(html).toContain("Un-default product");
		expect(html).toContain("Un-default effect");
		expect(html).not.toContain(">Default</span>");
		expect(html).not.toContain(">Un-default</button>");
	});

	it("keeps queued producer jobs in the action button", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						pausedAtMs: undefined,
						progress: undefined,
						remainingMs: undefined,
						queuedJobs: 2,
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Queued · +1 queued");
		expect(html).toContain("--ui-progress-button-start:0");
		expect(html).toContain("transform:scaleX(0)");
		expect(html).not.toContain("mt-2 h-1.5 overflow-hidden");
	});

	it("shows blocked delivery without rendering fake running progress", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						deliveryBlocked: true,
						pausedAtMs: undefined,
						progress: undefined,
					}),
				]}
				pending={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).toContain("Delivery blocked");
		expect(html).not.toContain("Running");
		expect(html).not.toContain("Queue full</button>");
	});

	it("hides default controls for producer-like views that do not support player defaults", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{}}
				lines={[
					createLine({
						inProgress: false,
						isDefault: false,
						pausedAtMs: undefined,
						queueFull: false,
						readyAtMs: undefined,
						startAtMs: undefined,
					}),
				]}
				pending={false}
				canSetDefault={false}
				onSetDefault={() => undefined}
				onStart={() => undefined}
				onWithdrawInput={() => undefined}
			/>,
		);

		expect(html).not.toContain(">Default</button>");
		expect(html).toContain(">Start</span></button>");
	});
});
