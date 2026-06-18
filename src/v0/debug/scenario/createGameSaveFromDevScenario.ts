import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { DevScenarioById, type DevScenarioId } from "~/v0/debug/scenario/DevScenarioDefinitions";

export namespace createGameSaveFromDevScenario {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		scenarioId: DevScenarioId;
	}
}

export const createGameSaveFromDevScenario = ({
	config,
	nowMs,
	scenarioId,
}: createGameSaveFromDevScenario.Props): GameSave => {
	const scenario = DevScenarioById[scenarioId];
	if (!scenario) throw new Error(`Unknown dev scenario ${scenarioId}.`);

	const boardItems: GameSave["board"]["items"] = {};
	const occupiedCells = new Set<string>();
	for (const item of scenario.board) {
		const cellKey = `${item.x}:${item.y}`;
		if (occupiedCells.has(cellKey)) {
			throw new Error(`Dev scenario "${scenarioId}" has duplicate board cell ${cellKey}.`);
		}
		if (!config.items[item.itemId]) {
			throw new Error(`Dev scenario "${scenarioId}" references missing item ${item.itemId}.`);
		}

		occupiedCells.add(cellKey);
		boardItems[item.id] = {
			id: item.id,
			itemId: item.itemId,
			x: item.x,
			y: item.y,
		};
	}

	const inventorySlots: GameSave["inventory"]["slots"] = Array.from(
		{
			length: config.game.inventory.slots,
		},
		() => null,
	);
	for (const stack of scenario.inventory) {
		if (stack.slotIndex < 0 || stack.slotIndex >= inventorySlots.length) {
			throw new Error(
				`Dev scenario "${scenarioId}" inventory slot ${stack.slotIndex} is outside configured inventory.`,
			);
		}
		if (inventorySlots[stack.slotIndex]) {
			throw new Error(
				`Dev scenario "${scenarioId}" has duplicate inventory slot ${stack.slotIndex}.`,
			);
		}
		if (!config.items[stack.itemId]) {
			throw new Error(
				`Dev scenario "${scenarioId}" references missing item ${stack.itemId}.`,
			);
		}

		inventorySlots[stack.slotIndex] = {
			itemId: stack.itemId,
			quantity: stack.quantity,
		};
	}

	return {
		board: {
			items: boardItems,
		},
		createdAtMs: nowMs,
		craftInputs: {},
		craftJobs: {},
		gameId: config.game.id,
		inventory: {
			slots: inventorySlots,
		},
		nextItemInstanceIndex: 1,
		nextJobIndex: 1,
		nextScheduledEventIndex: 1,
		producerInputs: {},
		producerJobs: {},
		producerLines: {},
		scheduledEvents: {},
		stashes: {},
		storedRequirements: {},
		upgradeJobs: {},
		upgrades: {},
		updatedAtMs: nowMs,
		version: 1,
	};
};
