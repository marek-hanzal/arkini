import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";

const productLine = (
	overrides: Partial<ProducerLineView> & Pick<ProducerLineView, "lineId">,
): ProducerLineView => {
	const { lineId, ...rest } = overrides;

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
		name: lineId,
		lineKind: "product" as const,
		lineId,
		producerQueuedJobs: 0,
		queueFull: false,
		blocked: false,
		queueSize: 1,
		queuedJobs: 0,
		...rest,
	};
};

const producerTarget = (producerLines: ProducerLineView[]): BoardViewItem => ({
	activation: {
		inputs: [],
		kind: "producer",
		producerLines,
		trigger: "click",
	},
	id: "producer",
	itemId: "item:producer",
	state: {},
	x: 0,
	y: 0,
});

const stashTarget = (producerLines: ProducerLineView[]): BoardViewItem => ({
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
		producerLines,
		trigger: "click",
	},
	id: "stash",
	itemId: "item:stash",
	state: {},
	x: 0,
	y: 0,
});

describe("resolveItemToBoardItemInteractionPlan", () => {
	it("routes producer inputs into the default producer line before earlier matching lines", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: producerTarget([
				productLine({
					lineId: "line:first",
				}),
				productLine({
					isDefault: true,
					lineId: "line:default",
				}),
			]),
		});

		expect(plan).toMatchObject({
			lineId: "line:default",
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
					lineId: "line:default",
				}),
				productLine({
					lineId: "line:next",
				}),
				productLine({
					lineId: "line:last",
				}),
			]),
		});

		expect(plan).toMatchObject({
			lineId: "line:next",
			type: "producer-input",
		});
	});

	it("routes stash inputs to stash open even when shared producer-line views are present", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: stashTarget([
				productLine({
					lineId: "line:stash",
				}),
			]),
		});

		expect(plan).toMatchObject({
			type: "stash-input",
		});
	});

	it("routes configured removal tools to tile removal", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:axe",
			targetItem: {
				id: "rock",
				itemId: "item:rock",
				state: {},
				x: 0,
				y: 0,
			},
		});

		expect(plan).toMatchObject({
			type: "tile-remove",
		});
	});

	it("does not show producer product passive grants as droppable stored slots", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:water",
			targetItem: producerTarget([
				productLine({
					lineId: "line:watered",
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
					lineId: "line:running",
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
