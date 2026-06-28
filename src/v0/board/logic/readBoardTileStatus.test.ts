import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readBoardTileStatus } from "~/v0/board/logic/readBoardTileStatus";

const boardItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "item-instance:producer",
	itemId: "producer:test",
	state: {},
	x: 0,
	y: 0,
	...overrides,
});

describe("readBoardTileStatus", () => {
	it("dims producers without explicit default product line", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						productLines: [
							{
								blocked: false,
								blockReasonEffectIds: [],
								durationMs: 1000,
								inProgress: false,
								inputItemIds: [],
								inputs: [],
								inputsAvailable: true,
								inputsReady: true,
								isDefault: false,
								missingRequirementItemIds: [],
								name: "Product",
								producerQueuedJobs: 0,
								productId: "product:test",
								queueFull: false,
								queuedJobs: 0,
								queueSize: 1,
								requirementItemIds: [],
								requirementsReady: true,
							},
						],
						requirements: [],
						trigger: "click",
					},
				}),
				nowMs: 0,
			}),
		).toMatchObject({
			ready: false,
		});
	});

	it("marks producers with runnable explicit default product line ready", () => {
		expect(
			readBoardTileStatus({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						productLines: [
							{
								blocked: false,
								blockReasonEffectIds: [],
								durationMs: 1000,
								inProgress: false,
								inputItemIds: [],
								inputs: [],
								inputsAvailable: true,
								inputsReady: true,
								isDefault: true,
								missingRequirementItemIds: [],
								name: "Product",
								producerQueuedJobs: 0,
								productId: "product:test",
								queueFull: false,
								queuedJobs: 0,
								queueSize: 1,
								requirementItemIds: [],
								requirementsReady: true,
							},
						],
						requirements: [],
						trigger: "click",
					},
				}),
				nowMs: 0,
			}),
		).toMatchObject({
			ready: true,
		});
	});
});
