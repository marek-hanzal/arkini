import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineVisualPlan } from "~/play/game-engine-visual/createGameEngineVisualPlan";

const boardView = (items: Parameters<typeof rebuildBoardView>[0]) => rebuildBoardView(items);
const emptyInventory = () => rebuildInventoryView([]);

describe("createGameEngineVisualPlan board stack visuals", () => {
	it("maps producer output stacked onto an existing board item to a transient fly and stack feedback", () => {
		const previousBoard = boardView([
			{
				id: "producer",
				itemId: "item:producer",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "stack",
				itemId: "item:twig",
				quantity: 1,
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
				{
					id: "stack",
					itemId: "item:twig",
					quantity: 2,
					state: {},
					x: 1,
					y: 0,
				},
			]),
			currentInventory: emptyInventory(),
			events: [
				{
					itemId: "item:twig",
					originItemInstanceId: "producer",
					reason: "line-output",
					to: {
						itemInstanceId: "stack",
						kind: "board",
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardEnterRequests).toHaveLength(0);
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					durationMs: 1000,
					kind: "fly-to-tile",
					toTileId: "stack",
				},
			},
			tile: {
				itemId: "item:twig",
				slotId: "0:0",
			},
		});
		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				delayMs: 1000,
				kind: "bounce",
			},
			tileId: "stack",
		});
	});

	it("maps board stack actions to consumed item fly and target feedback", () => {
		const previousBoard = boardView([
			{
				id: "source",
				itemId: "item:twig",
				quantity: 2,
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "target",
				itemId: "item:twig",
				quantity: 2,
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "source",
					itemId: "item:twig",
					quantity: 1,
					state: {},
					x: 0,
					y: 0,
				},
				{
					id: "target",
					itemId: "item:twig",
					quantity: 3,
					state: {},
					x: 1,
					y: 0,
				},
			]),
			currentInventory: emptyInventory(),
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
						nextQuantity: 1,
						previousQuantity: 2,
						quantity: 1,
					},
					itemId: "item:twig",
					reason: "board-stack",
					type: "item.consumed",
				},
				{
					itemId: "item:twig",
					reason: "board-stack",
					to: {
						itemInstanceId: "target",
						kind: "board",
						quantity: 1,
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardEnterRequests).toHaveLength(0);
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					durationMs: 1000,
					kind: "fly-to-tile",
					toTileId: "target",
				},
			},
			tile: {
				itemId: "item:twig",
				slotId: "0:0",
			},
		});
		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				delayMs: 1000,
				kind: "bounce",
			},
			tileId: "target",
		});
	});
});
