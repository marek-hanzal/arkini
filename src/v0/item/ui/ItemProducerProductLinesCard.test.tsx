import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemProducerProductLinesCard } from "~/v0/item/ui/ItemProducerProductLinesCard";

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	blockReasonEffectIds: [],
	durationMs: 5000,
	inProgress: true,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: true,
	missingRequirementItemIds: [],
	name: "Log",
	pausedAtMs: 1000,
	producerQueuedJobs: 1,
	productId: "product:lumberjack-t1:log",
	progress: 0.2,
	remainingMs: 4000,
	queueFull: true,
	queuedJobs: 1,
	queueSize: 1,
	readyAtMs: 5000,
	requirementItemIds: [],
	requirementsReady: false,
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
						lineKind: "effect",
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
						requirementsReady: true,
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
						requirementsReady: true,
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

	it("hides satisfied product-line requirement rows", () => {
		const html = renderToStaticMarkup(
			<ItemProducerProductLinesCard
				items={{
					"item:done": {
						assetSrc: "done.svg",
						description: "Done requirement",
						generatedEffects: [],
						id: "item:done",
						maxStackSize: 1,
						name: "Done requirement",
						storage: "both",
						tags: [],
					},
					"item:missing": {
						assetSrc: "missing.svg",
						description: "Missing requirement",
						generatedEffects: [],
						id: "item:missing",
						maxStackSize: 1,
						name: "Missing requirement",
						storage: "both",
						tags: [],
					},
				}}
				lines={[
					createLine({
						requirements: [
							{
								capacity: 1,
								itemId: "item:done",
								quantity: 1,
								stored: 1,
								type: "passive",
							},
							{
								capacity: 1,
								itemId: "item:missing",
								quantity: 1,
								stored: 0,
								type: "passive",
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

		expect(html).not.toContain("Done requirement");
		expect(html).toContain("Missing requirement");
		expect(html).not.toContain("ready");
	});
});
