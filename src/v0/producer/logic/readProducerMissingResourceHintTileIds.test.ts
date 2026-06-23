import { describe, expect, it } from "vitest";
import { readProducerMissingResourceHintTileIds } from "~/v0/producer/logic/readProducerMissingResourceHintTileIds";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

const config = {
	items: {
		"item:source-producer": {
			producerId: "producer:source",
		},
		"item:target-producer": {
			producerId: "producer:target",
		},
	},
	lootTables: {
		"loot:water": {
			output: [
				{
					itemId: "item:water",
					quantity: 1,
					type: "guaranteed",
				},
			],
		},
	},
	producers: {
		"producer:source": {
			productIds: [
				"product:source-water",
			],
		},
		"producer:target": {
			productIds: [
				"product:target",
			],
		},
	},
	products: {
		"product:source-water": {
			outputTableId: "loot:water",
		},
		"product:target": {},
	},
} as unknown as GameConfig;

const line = (overrides: Partial<ProducerProductLineView>): ProducerProductLineView => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: false,
	inputsReady: false,
	isDefault: true,
	missingRequirementItemIds: [],
	name: "Target",
	producerQueuedJobs: 0,
	productId: "product:target",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
	requirementItemIds: [],
	requirements: [],
	requirementsReady: true,
	...overrides,
});

const item = (props: {
	id: string;
	itemId: string;
	x: number;
	y: number;
	line?: ProducerProductLineView;
}): BoardViewItem => ({
	id: props.id,
	itemId: props.itemId,
	state: {},
	x: props.x,
	y: props.y,
	...(props.line
		? {
				activation: {
					inputs: [],
					kind: "producer" as const,
					productLines: [
						props.line,
					],
					requirements: [],
					trigger: "click" as const,
				},
			}
		: {}),
});

const board = (items: readonly BoardViewItem[]): BoardView => ({
	byCellKey: Object.fromEntries(
		items.map((boardItem) => [
			`${boardItem.x}:${boardItem.y}`,
			boardItem,
		]),
	),
	byId: Object.fromEntries(
		items.map((boardItem) => [
			boardItem.id,
			boardItem,
		]),
	),
	items: [
		...items,
	],
});

describe("readProducerMissingResourceHintTileIds", () => {
	it("does not bounce proximity requirement items that already satisfy the selected line", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({
				requirements: [
					{
						distance: 1,
						itemIds: [
							"item:tree",
						],
						matchedDistance: 1,
						matchedItemId: "item:tree",
						satisfied: true,
						type: "proximity",
					},
				],
				requirementsReady: true,
			}),
			x: 0,
			y: 0,
		});
		const tree = item({
			id: "tree",
			itemId: "item:tree",
			x: 1,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					tree,
				]),
				config,
				producerItem: target,
			}),
		).toEqual([]);
	});

	it("bounces proximity requirement items that are present but too far away", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({
				requirements: [
					{
						distance: 1,
						itemIds: [
							"item:tree",
						],
						matchedDistance: 3,
						matchedItemId: "item:tree",
						satisfied: false,
						type: "proximity",
					},
				],
				requirementsReady: false,
			}),
			x: 0,
			y: 0,
		});
		const tree = item({
			id: "tree",
			itemId: "item:tree",
			x: 3,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					tree,
				]),
				config,
				producerItem: target,
			}),
		).toEqual([
			"tree",
		]);
	});

	it("does not bounce producers for inputs already available on the board", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:water",
						quantity: 1,
						stored: 0,
					},
				],
				inputItemIds: [
					"item:water",
				],
			}),
			x: 0,
			y: 0,
		});
		const source = item({
			id: "source",
			itemId: "item:source-producer",
			x: 1,
			y: 0,
		});
		const water = item({
			id: "water",
			itemId: "item:water",
			x: 2,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					source,
					water,
				]),
				config,
				producerItem: target,
			}),
		).toEqual([]);
	});

	it("bounces producers for input items missing from the board", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:water",
						quantity: 1,
						stored: 0,
					},
				],
				inputItemIds: [
					"item:water",
				],
			}),
			x: 0,
			y: 0,
		});
		const source = item({
			id: "source",
			itemId: "item:source-producer",
			x: 1,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					source,
				]),
				config,
				producerItem: target,
			}),
		).toEqual([
			"source",
		]);
	});
});
