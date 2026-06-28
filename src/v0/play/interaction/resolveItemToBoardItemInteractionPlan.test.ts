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
		missingRequirementItemIds: [],
		name: productId,
		productId,
		producerQueuedJobs: 0,
		queueFull: false,
		blocked: false,
		blockReasonEffectIds: [],
		queueSize: 1,
		queuedJobs: 0,
		requirementItemIds: [],
		requirements: [],
		requirementsReady: true,
		...rest,
	};
};

const producerTarget = (productLines: ProducerProductLineView[]): BoardViewItem => ({
	activation: {
		inputs: [],
		kind: "producer",
		productLines,
		requirements: [],
		trigger: "click",
	},
	id: "producer",
	itemId: "item:producer",
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

	it("does not show producer product passive requirements as droppable stored requirements", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:water",
			targetItem: producerTarget([
				productLine({
					missingRequirementItemIds: [
						"item:water",
					],
					productId: "product:watered",
					requirements: [
						{
							capacity: 1,
							itemId: "item:water",
							quantity: 1,
							stored: 0,
							type: "passive",
						},
					],
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "swap",
		});
	});

	it("shows producer product stored requirements as droppable", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:water",
			targetItem: producerTarget([
				productLine({
					productId: "product:watered",
					requirements: [
						{
							capacity: 1,
							itemId: "item:water",
							quantity: 1,
							stored: 0,
							type: "stored",
						},
					],
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "stored-requirement",
		});
	});
});
