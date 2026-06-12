import { gameDataIndex, type ItemId } from "~/domains/game-data";
import { GameActionError } from "./gameplayTypes";

export interface SaveShape {
  boardWidth: number;
  boardHeight: number;
  inventorySlots: number;
}

export type BoardRow = { id: string; itemDefinitionId: string; x: number; y: number; stateJson: string };
export type InventoryRow = { id: string; itemDefinitionId: string; slotIndex: number; quantity: number };

export interface PlacementPlan {
  board: { itemId: ItemId; x: number; y: number }[];
  inventory: InventoryPlacementPlan[];
}

export type InventoryPlacementPlan =
  | { type: "update"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number }
  | { type: "insert"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number };

export function planPlacements(
  save: SaveShape,
  boardRows: readonly BoardRow[],
  inventoryRows: readonly InventoryRow[],
  drops: readonly ItemId[],
  origin?: { x: number; y: number },
): PlacementPlan | null {
  const freeCells = findFreeBoardCells(save, boardRows, origin);
  const virtualInventory = cloneInventory(inventoryRows);
  const plan: PlacementPlan = { board: [], inventory: [] };

  for (const itemId of drops) {
    const cell = freeCells.shift();
    if (cell) {
      plan.board.push({ itemId, ...cell });
      continue;
    }

    const inventoryPlan = planInventoryPlacement(save, virtualInventory, itemId);
    if (!inventoryPlan) return null;
    plan.inventory.push(...inventoryPlan);
  }

  return plan;
}

export function planInventoryPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string): InventoryPlacementPlan[] | null {
  const stackPlan = planStackPlacement(inventory, itemId);
  if (stackPlan) return stackPlan;

  for (let slotIndex = 0; slotIndex < save.inventorySlots; slotIndex += 1) {
    const insertPlan = planEmptySlotPlacement(save, inventory, itemId, slotIndex);
    if (insertPlan) return insertPlan;
  }

  return null;
}

export function planExactInventorySlotPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string, slotIndex: number): InventoryPlacementPlan[] | null {
  assertInsideInventory(save, slotIndex);

  const target = inventory.find((stack) => stack.slotIndex === slotIndex);
  if (!target) return planEmptySlotPlacement(save, inventory, itemId, slotIndex);
  if (target.itemDefinitionId !== itemId) return null;

  return planStackPlacement([target], itemId);
}

export function cloneInventory(rows: readonly InventoryRow[]) {
  return rows.map((row) => ({ ...row }));
}

function planStackPlacement(inventory: InventoryRow[], itemId: ItemId | string): InventoryPlacementPlan[] | null {
  const item = getItem(itemId);
  const stack = [...inventory]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .find((row) => row.itemDefinitionId === itemId && row.quantity < item.maxStackSize);

  if (!stack) return null;

  stack.quantity += 1;
  return [{ type: "update", stackId: stack.id, slotIndex: stack.slotIndex, itemId: itemId as ItemId, quantity: stack.quantity }];
}

function planEmptySlotPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string, slotIndex: number): InventoryPlacementPlan[] | null {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) return null;
  if (inventory.some((stack) => stack.slotIndex === slotIndex)) return null;

  const stackId = createId("inventory:virtual");
  inventory.push({ id: stackId, itemDefinitionId: itemId, slotIndex, quantity: 1 });

  return [{ type: "insert", stackId, slotIndex, itemId: itemId as ItemId, quantity: 1 }];
}

function findFreeBoardCells(save: SaveShape, boardRows: readonly { x: number; y: number }[], origin?: { x: number; y: number }) {
  const occupied = new Set(boardRows.map((item) => `${item.x}:${item.y}`));
  const cells: { x: number; y: number }[] = [];

  for (let y = 0; y < save.boardHeight; y += 1) {
    for (let x = 0; x < save.boardWidth; x += 1) {
      if (!occupied.has(`${x}:${y}`)) cells.push({ x, y });
    }
  }

  if (!origin) return cells;

  return cells.sort((a, b) => {
    const aDistance = manhattanDistance(a, origin);
    const bDistance = manhattanDistance(b, origin);

    if (aDistance !== bDistance) return aDistance - bDistance;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

function assertInsideInventory(save: SaveShape, slotIndex: number) {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }
}

function getItem(itemId: string) {
  const item = gameDataIndex.itemsById.get(itemId as ItemId);
  if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
  return item;
}

function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${crypto.randomUUID()}`;
}
