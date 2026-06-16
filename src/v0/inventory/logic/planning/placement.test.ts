import { describe, expect, it } from "vitest";
import { GameConfigServiceLive } from "~/v0/game/logic/GameConfigServiceLive";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { planPlacements } from "~/v0/inventory/logic/planning/placement";
import type { IdService } from "~/v0/id/context/IdServiceFx";
import type { InventoryRow } from "~/v0/inventory/model/InventoryRow";
import type { BoardRow } from "~/v0/board/model/BoardRow";
import type { SaveShape } from "~/v0/play/save/model/SaveShape";

const save = (overrides: Partial<SaveShape> = {}): SaveShape => ({
	boardWidth: 1,
	boardHeight: 1,
	inventorySlots: 1,
	...overrides,
});

const idService = (): IdService => {
	let next = 0;
	return {
		uuid: () => `uuid:${next++}`,
		prefixed: (prefix) => `${prefix}:${next++}`,
		boardItem: () => `board:${next++}`,
		inventoryVirtual: () => `inventory:${next++}`,
	};
};

const boardRow = (overrides: Partial<BoardRow> = {}): BoardRow => ({
	id: "board:occupied",
	itemDefinitionId: "item:twig",
	x: 0,
	y: 0,
	stateJson: "{}",
	...overrides,
});

const inventoryRow = (overrides: Partial<InventoryRow> = {}): InventoryRow => ({
	id: "stack:occupied",
	itemDefinitionId: "item:twig",
	slotIndex: 0,
	quantity: 50,
	stateJson: emptyInventoryStateJson,
	...overrides,
});

describe("planPlacements", () => {
	it("returns null when activation output has no board or inventory space", () => {
		const plan = planPlacements(
			save(),
			[
				boardRow(),
			],
			[
				inventoryRow(),
			],
			[
				"item:twig",
			],
			{
				gameConfig: GameConfigServiceLive,
				id: idService(),
			},
		);

		expect(plan).toBeNull();
	});

	it("prefers free board cells before inventing inventory stacks", () => {
		const plan = planPlacements(
			save({
				boardWidth: 2,
				inventorySlots: 1,
			}),
			[
				boardRow(),
			],
			[],
			[
				"item:twig",
			],
			{
				gameConfig: GameConfigServiceLive,
				id: idService(),
			},
		);

		expect(plan?.board).toEqual([
			{
				itemId: "item:twig",
				x: 1,
				y: 0,
			},
		]);
		expect(plan?.inventory).toEqual([]);
	});

	it("uses a virtual inventory clone so multi-drop planning does not mutate caller rows", () => {
		const inventory: InventoryRow[] = [
			inventoryRow({
				quantity: 49,
			}),
		];

		const plan = planPlacements(
			save({
				inventorySlots: 2,
			}),
			[
				boardRow(),
			],
			inventory,
			[
				"item:twig",
				"item:twig",
			],
			{
				gameConfig: GameConfigServiceLive,
				id: idService(),
			},
		);

		expect(plan?.inventory).toEqual([
			{
				itemId: "item:twig",
				quantity: 50,
				slotIndex: 0,
				stackId: "stack:occupied",
				stateJson: emptyInventoryStateJson,
				type: "update",
			},
			{
				itemId: "item:twig",
				quantity: 1,
				slotIndex: 1,
				stackId: "inventory:0",
				stateJson: emptyInventoryStateJson,
				type: "insert",
			},
		]);
		expect(inventory[0]?.quantity).toBe(49);
	});
});
