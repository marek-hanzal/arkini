import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { LineView } from "~/board/view/LineViewSchema";
import { readBoardTileStatus } from "~/board/view/readBoardTileStatus";

const line = (overrides: Partial<LineView> = {}): LineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Product",
	kind: "product" as const,
	queueUsed: 0,
	lineId: "line:test",
	queueFull: false,
	jobs: 0,
	queueMax: 1,
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
	it("keeps producers without explicit default line visually neutral", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						lines: [
							line({
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

	it("dims producers with blocked explicit default line", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						lines: [
							line({
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

	it("marks producers with runnable explicit default line ready", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						lines: [
							line({
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
