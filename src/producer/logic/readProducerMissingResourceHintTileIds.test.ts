import { describe, expect, it } from "vitest";
import { readProducerMissingResourceHintTileIds } from "~/producer/logic/readProducerMissingResourceHintTileIds";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { LineView } from "~/board/view/LineViewSchema";
const line = (overrides: Partial<LineView>): LineView => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: false,
	inputsReady: false,
	isDefault: true,
	name: "Target",
	kind: "product" as const,
	queueUsed: 0,
	lineId: "line:target",
	queueFull: false,
	blocked: false,
	jobs: 0,
	queueMax: 1,
	...overrides,
});

const item = (props: {
	id: string;
	itemId: string;
	x: number;
	y: number;
	line?: LineView;
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
					lines: [
						props.line,
					],
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
	it("does not bounce local grant sources through the input hint path", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({}),
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
				producerItem: target,
			}),
		).toEqual([]);
	});

	it("does not bounce out-of-range grant sources through the input hint path", () => {
		const target = item({
			id: "target",
			itemId: "item:target-producer",
			line: line({}),
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
				producerItem: target,
			}),
		).toEqual([]);
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
			line: line({
				outputs: [
					{
						enabled: true,
						itemId: "item:water",
						kind: "guaranteed",
						ownedQuantity: 0,
						quantity: 1,
					},
				],
				lineId: "line:source-water",
			}),
			x: 1,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					source,
				]),
				producerItem: target,
			}),
		).toEqual([
			"source",
		]);
	});

	it("does not bounce producers whose effective output view is disabled", () => {
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
			line: line({
				outputs: [
					{
						enabled: false,
						itemId: "item:water",
						kind: "guaranteed",
						ownedQuantity: 0,
						quantity: 1,
					},
				],
				lineId: "line:source-water",
			}),
			x: 1,
			y: 0,
		});

		expect(
			readProducerMissingResourceHintTileIds({
				board: board([
					target,
					source,
				]),
				producerItem: target,
			}),
		).toEqual([]);
	});
});
