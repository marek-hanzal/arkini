import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";

const productLine = (
	overrides: Partial<ProducerProductLineView> & Pick<ProducerProductLineView, "productId">,
): ProducerProductLineView => {
	const { productId, ...rest } = overrides;

	return {
		durationMs: 1000,
		inProgress: false,
		inputItemIds: [
			"item:twig",
		],
		inputs: [
			{
				capacity: 1,
				consume: true,
				itemId: "item:twig",
				quantity: 1,
				stored: 0,
			},
		],
		inputsAvailable: true,
		inputsReady: false,
		isDefault: false,
		name: productId,
		productId,
		producerQueuedJobs: 0,
		queueFull: false,
		blocked: false,
		blockReasonEffectIds: [],
		queueSize: 1,
		queuedJobs: 0,
		...rest,
	};
};

const producerTarget = (productLines: ProducerProductLineView[]): BoardViewItem => ({
	activation: {
		inputs: [],
		kind: "producer",
		productLines,
		trigger: "click",
	},
	id: "producer",
	itemId: "item:producer",
	state: {},
	x: 0,
	y: 0,
});

const stashTarget = (productLines: ProducerProductLineView[]): BoardViewItem => ({
	activation: {
		inputs: [
			{
				capacity: 1,
				consume: true,
				itemId: "item:twig",
				quantity: 1,
				stored: 0,
			},
		],
		kind: "stash",
		productLines,
		trigger: "click",
	},
	id: "stash",
	itemId: "item:stash",
	state: {},
	x: 0,
	y: 0,
});

describe("resolveItemToBoardItemInteractionPlan", () => {
	it("routes producer inputs into the default product line before earlier matching lines", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: producerTarget([
				productLine({
					productId: "product:first",
				}),
				productLine({
					isDefault: true,
					productId: "product:default",
				}),
			]),
		});

		expect(plan).toMatchObject({
			productId: "product:default",
			type: "producer-input",
		});
	});

	it("routes producer inputs into the first later line with capacity when the default line is full", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: producerTarget([
				productLine({
					isDefault: true,
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
							stored: 1,
						},
					],
					productId: "product:default",
				}),
				productLine({
					productId: "product:next",
				}),
				productLine({
					productId: "product:last",
				}),
			]),
		});

		expect(plan).toMatchObject({
			productId: "product:next",
			type: "producer-input",
		});
	});

	it("routes stash inputs to stash open even when shared producer-line views are present", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: stashTarget([
				productLine({
					productId: "product:stash",
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "stash-input",
		});
	});

	it("does not show producer product passive grants as droppable stored slots", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:water",
			targetItem: producerTarget([
				productLine({
					productId: "product:watered",
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "swap",
		});
	});

	it("does not route replacement merges into producer-like targets with runtime jobs", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: producerTarget([
				productLine({
					inProgress: true,
					productId: "product:running",
					producerQueuedJobs: 1,
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "producer-input",
		});
	});

	it("does not route replacement merges into targets with stored runtime state", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: {
				...producerTarget([]),
				craft: {
					acceptedInputItemIds: [
						"item:twig",
					],
					canAcceptInputs: true,
					complete: false,
					delivered: {
						"item:twig": 1,
					},
					durationMs: 1000,
					id: "craft:test",
					inputProgress: 0.5,
					inputs: [
						{
							itemId: "item:twig",
							quantity: 2,
						},
					],
					phase: "collecting_inputs",
					progress: 0.5,
					resultItemId: "item:plank",
					timeProgress: 0,
				},
			},
		});

		expect(plan).toMatchObject({
			type: "craft-input",
		});
	});
});
