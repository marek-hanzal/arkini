import { describe, expect, it } from "vitest";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { resolveOptimisticBoardMergeVisualEvent } from "~/v0/board/logic/resolveOptimisticBoardMergeVisualEvent";

const board = (items: BoardView["items"]): BoardView => rebuildBoardView(items);

describe("resolveOptimisticBoardMergeVisualEvent", () => {
	it("creates an optimistic merge event from board state and manifest merge rules", () => {
		expect(
			resolveOptimisticBoardMergeVisualEvent({
				board: board([
					{
						id: "source",
						itemId: "item:twig",
						state: {},
						x: 0,
						y: 0,
					},
					{
						id: "target",
						itemId: "item:twig",
						state: {},
						x: 1,
						y: 0,
					},
				]),
				input: {
					sourceBoardItemId: "source",
					targetBoardItemId: "target",
				},
			}),
		).toMatchObject({
			type: "item.merged",
			animation: {
				cause: "merge",
				effect: "merge",
				groupId: "merge:source:target",
				mode: "parallel",
			},
			consumeSource: true,
			resultItemId: "item:branch",
			sourceItemInstanceId: "source",
			targetItemInstanceId: "target",
		});
	});

	it("skips missing board items and unsupported merges", () => {
		const current = board([
			{
				id: "source",
				itemId: "item:twig",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "target",
				itemId: "item:pebble",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		expect(
			resolveOptimisticBoardMergeVisualEvent({
				board: current,
				input: {
					sourceBoardItemId: "missing",
					targetBoardItemId: "target",
				},
			}),
		).toBeNull();
		expect(
			resolveOptimisticBoardMergeVisualEvent({
				board: current,
				input: {
					sourceBoardItemId: "source",
					targetBoardItemId: "target",
				},
			}),
		).toBeNull();
	});
});
