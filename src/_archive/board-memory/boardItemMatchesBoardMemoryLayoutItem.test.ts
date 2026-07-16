import { describe, expect, it } from "vitest";
import { boardItemMatchesBoardMemoryIdentity } from "~/board-memory/boardItemMatchesBoardMemoryIdentity";
import { boardItemMatchesBoardMemoryLayoutItem } from "~/board-memory/boardItemMatchesBoardMemoryLayoutItem";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

const boardItem = (overrides: Partial<GameSaveBoardItem> = {}): GameSaveBoardItem => ({
	id: "board:item",
	itemId: "item:twig",
	quantity: 3,
	x: 1,
	y: 1,
	...overrides,
});

const memoryItem = (overrides: Partial<BoardMemoryLayoutItem> = {}): BoardMemoryLayoutItem => ({
	itemId: "item:twig",
	quantity: 3,
	x: 1,
	y: 1,
	...overrides,
});

describe("board memory layout matching", () => {
	it("matches identity by item id, optional instance id and quantity", () => {
		expect(
			boardItemMatchesBoardMemoryIdentity({
				boardItem: boardItem({
					id: "a",
				}),
				memoryItem: memoryItem({
					itemInstanceId: "a",
				}),
			}),
		).toBe(true);
		expect(
			boardItemMatchesBoardMemoryIdentity({
				boardItem: boardItem({
					id: "b",
				}),
				memoryItem: memoryItem({
					itemInstanceId: "a",
				}),
			}),
		).toBe(false);
		expect(
			boardItemMatchesBoardMemoryIdentity({
				boardItem: boardItem({
					quantity: 2,
				}),
				memoryItem: memoryItem({
					quantity: 3,
				}),
			}),
		).toBe(false);
	});

	it("matches a full layout item only when identity and cell both match", () => {
		expect(
			boardItemMatchesBoardMemoryLayoutItem({
				boardItem: boardItem(),
				memoryItem: memoryItem(),
			}),
		).toBe(true);
		expect(
			boardItemMatchesBoardMemoryLayoutItem({
				boardItem: boardItem({
					x: 2,
				}),
				memoryItem: memoryItem(),
			}),
		).toBe(false);
	});
});
