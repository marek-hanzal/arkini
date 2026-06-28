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

		expect(html).toContain("Paused");
		expect(html).toContain("4s");
		expect(html).not.toContain("Queue full</button>");
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
		expect(html).toContain(">Start</button>");
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
