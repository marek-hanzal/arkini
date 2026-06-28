import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { readBoardItemStoreState } from "~/v0/item/logic/readBoardItemStoreState";

const item = (overrides: Partial<ViewItem> = {}): ViewItem => ({
	assetSrc: "test.svg",
	description: "Test item",
	generatedEffects: [],
	id: "item:test",
	maxStackSize: 10,
	name: "Test item",
	storage: "both",
	tags: [],
	...overrides,
});

const boardItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "item-instance:1",
	itemId: "item:test",
	state: {},
	x: 0,
	y: 0,
	...overrides,
});

describe("readBoardItemStoreState", () => {
	it("allows idle inventory-storable board items", () => {
		expect(
			readBoardItemStoreState({
				boardItem: boardItem(),
				item: item(),
			}),
		).toEqual({
			canStore: true,
		});
	});

	it("blocks board-only items", () => {
		expect(
			readBoardItemStoreState({
				boardItem: boardItem(),
				item: item({
					storage: "board",
				}),
			}),
		).toEqual({
			canStore: false,
			reason: "storage_restricted",
		});
	});

	it("blocks running craft items", () => {
		expect(
			readBoardItemStoreState({
				boardItem: boardItem({
					craft: {
						acceptedInputItemIds: [],
						canAcceptInputs: false,
						complete: false,
						delivered: {},
						durationMs: 1000,
						id: "recipe:test",
						inputProgress: 1,
						inputs: [],
						phase: "waiting",
						progress: 0.5,
						readyAtMs: 1000,
						resultItemId: "item:result",
						startAtMs: 0,
						timeProgress: 0.5,
					},
				}),
				item: item(),
			}),
		).toEqual({
			canStore: false,
			reason: "busy",
		});
	});

	it("blocks producer-like items with queued jobs", () => {
		expect(
			readBoardItemStoreState({
				boardItem: boardItem({
					activation: {
						inputs: [],
						kind: "producer",
						productLines: [
							{
								blocked: false,
								blockReasonEffectIds: [],
								durationMs: 1000,
								inProgress: true,
								inputItemIds: [],
								inputs: [],
								inputsAvailable: true,
								inputsReady: true,
								isDefault: true,
								missingRequirementItemIds: [],
								name: "Product",
								producerQueuedJobs: 1,
								productId: "product:test",
								queueFull: true,
								queuedJobs: 1,
								queueSize: 1,
								requirementItemIds: [],
								requirementsReady: true,
							},
						],
						requirements: [],
						trigger: "click",
					},
				}),
				item: item(),
			}),
		).toEqual({
			canStore: false,
			reason: "busy",
		});
	});
});
