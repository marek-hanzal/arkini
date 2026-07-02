import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { LineView } from "~/v0/board/view/LineViewSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";

const line = (overrides: Partial<LineView> & Pick<LineView, "lineId">): LineView => {
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
		kind: "product" as const,
		lineId,
		queueUsed: 0,
		queueFull: false,
		blocked: false,
		queueMax: 1,
		jobs: 0,
		...rest,
	};
};

const producerTarget = (lines: LineView[]): BoardViewItem => ({
	activation: {
		inputs: [],
		kind: "producer",
		lines,
		trigger: "click",
	},
	id: "producer",
	itemId: "item:producer",
	state: {},
	x: 0,
	y: 0,
});

const stashTarget = (lines: LineView[]): BoardViewItem => ({
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
		lines,
		trigger: "click",
	},
	id: "stash",
	itemId: "item:stash",
	state: {},
	x: 0,
	y: 0,
});

describe("resolveItemToBoardItemInteractionPlan", () => {
	it("routes producer inputs into the default line before earlier matching lines", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: producerTarget([
				line({
					lineId: "line:first",
				}),
				line({
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
				line({
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
				line({
					lineId: "line:next",
				}),
				line({
					lineId: "line:last",
				}),
			]),
		});

		expect(plan).toMatchObject({
			lineId: "line:next",
			type: "producer-input",
		});
	});

	it("routes stash inputs to stash open even when shared line views are present", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:twig",
			targetItem: stashTarget([
				line({
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

	it("does not show line passive grants as droppable stored slots", () => {
		const plan = resolveItemToBoardItemInteractionPlan({
			config: createEngineTestConfig(),
			sourceItemId: "item:water",
			targetItem: producerTarget([
				line({
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
				line({
					inProgress: true,
					lineId: "line:running",
					queueUsed: 1,
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
