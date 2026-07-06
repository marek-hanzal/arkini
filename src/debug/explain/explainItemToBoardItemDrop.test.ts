import { describe, expect, it } from "vitest";
import { readRuntimeBoardViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { createGameScenario } from "~/engine/test/GameScenario";
import { explainItemToBoardItemDrop } from "~/debug/explain/explainItemToBoardItemDrop";

const readBoardTarget = ({ itemId, x, y }: { itemId: string; x: number; y: number }) => {
	const config = createEngineTestConfig();
	const scenario = createGameScenario({
		config,
	}).withBoardItems([
		{
			id: "target",
			itemId,
			x,
			y,
		},
	]);
	const board = readRuntimeBoardViewFromGameSave({
		config,
		nowMs: scenario.nowMs,
		save: scenario.save,
	});
	return {
		config,
		target: board.byId.target!,
	};
};

describe("explainItemToBoardItemDrop", () => {
	it("explains accepted partial craft input quantities", () => {
		const { config, target } = readBoardTarget({
			itemId: "item:craft-table",
			x: 0,
			y: 0,
		});

		expect(
			explainItemToBoardItemDrop({
				config,
				sourceItemId: "item:twig",
				sourceKind: "board",
				sourceQuantity: 5,
				targetItem: target,
			}),
		).toMatchObject({
			kind: "item-to-board-item-drop",
			outcome: "accepted",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "accepted_craft_input",
					details: expect.objectContaining({
						acceptedQuantity: 2,
					}),
				}),
			]),
		});
	});

	it("explains why inventory drops onto occupied cells are blocked when no interaction matches", () => {
		const { config, target } = readBoardTarget({
			itemId: "item:craft-table",
			x: 0,
			y: 0,
		});

		expect(
			explainItemToBoardItemDrop({
				config,
				sourceItemId: "item:key",
				sourceKind: "inventory",
				targetItem: target,
			}),
		).toMatchObject({
			outcome: "blocked",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "blocked_inventory_occupied_cell",
				}),
			]),
		});
	});
});
