import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import { readBoardTileStatus } from "~/v0/board/logic/readBoardTileStatus";

const productLine = (overrides: Partial<ProducerLineView> = {}): ProducerLineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Product",
	lineKind: "product" as const,
	producerQueuedJobs: 0,
	lineId: "line:test",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
	...overrides,
});

const boardItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "item-instance:producer",
	itemId: "producer:test",
	state: {},
	x: 0,
	y: 0,
	...overrides,
});

describe("readBoardTileStatus", () => {
	it("keeps producers without explicit default producer line visually neutral", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						producerLines: [
							productLine({
								isDefault: false,
							}),
						],
						trigger: "click",
					},
				}),
				nowMs: 0,
			}),
		).toMatchObject({
			dimmed: false,
			ready: false,
		});
	});

	it("dims producers with blocked explicit default producer line", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						producerLines: [
							productLine({
								inputsAvailable: false,
								inputsReady: false,
								isDefault: true,
							}),
						],
						trigger: "click",
					},
				}),
				nowMs: 0,
			}),
		).toMatchObject({
			dimmed: true,
			ready: false,
		});
	});

	it("marks producers with runnable explicit default producer line ready", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						producerLines: [
							productLine({
								isDefault: true,
							}),
						],
						trigger: "click",
					},
				}),
				nowMs: 0,
			}),
		).toMatchObject({
			dimmed: false,
			ready: true,
		});
	});
});
