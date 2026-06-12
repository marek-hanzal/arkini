import { match } from "ts-pattern";
import { gameDataIndex } from "~/manifest/server/gameDataIndex";
import { resolveItemMergeRule } from "~/manifest/server/resolveItemMergeRule";
import type { BuildRecipeId, ItemId } from "~/manifest/server/manifestId";
import type { ProducerMode } from "~/manifest/server/producer";
import { createInitialBoardState, readBoardState } from "./boardState";
import { json } from "~/shared/json";
import { applyInventoryPlacementPlan, applyPlacementPlan } from "./applyPlacementPlan";
import { assertInsideBoard, assertInsideInventory } from "./gameBounds";
import { depleteProducer } from "./depleteProducer";
import { getItem, getProducer } from "./gameDefinitionLookup";
import { insertBoardItem } from "./boardItemStore";
import { readMutableSave } from "./readMutableSave";
import { removeInventoryItems, spendInventoryStack } from "./inventoryStackStore";
import { rollProducerDrops } from "./producerDrops";
import { serverTimestamp } from "./serverTimestamp";
import { canPayCosts } from "./gameView";
import { db } from "~/database/server/db";
import { table } from "~/database/server/tables";
import type { BoardItemState, ProducerDropResult } from "./gameplayTypes";
import { GameActionError } from "./gameplayTypes";
import {
  cloneInventory,
  planExactInventorySlotPlacement,
  planInventoryPlacement,
  planPlacements,
} from "./planning";

export async function placeInventoryItem(slotIndex: number, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    assertInsideBoard(save, x, y);

    const stack = inventoryRows.find((row) => row.slotIndex === slotIndex);
    if (!stack) throw new GameActionError("Inventory slot is empty.");
    if (boardRows.some((row) => row.x === x && row.y === y)) throw new GameActionError("Board cell is occupied.");

    await insertBoardItem(tx, stack.itemDefinitionId, x, y);
    await spendInventoryStack(tx, stack, 1);
  });
}

export async function swapInventorySlots(sourceSlotIndex: number, targetSlotIndex: number) {
  if (sourceSlotIndex === targetSlotIndex) return;

  await db.transaction().execute(async (tx) => {
    const { save, inventoryRows } = await readMutableSave(tx);
    assertInsideInventory(save, sourceSlotIndex);
    assertInsideInventory(save, targetSlotIndex);

    const source = inventoryRows.find((row) => row.slotIndex === sourceSlotIndex);
    const target = inventoryRows.find((row) => row.slotIndex === targetSlotIndex);
    if (!source) throw new GameActionError("Inventory slot is empty.");

    // Same item stacks combine before they swap. This keeps inventory as storage,
    // not a little shuffling minigame from a cursed accounting department.
    if (target && target.itemDefinitionId === source.itemDefinitionId) {
      const item = getItem(source.itemDefinitionId);
      const movable = Math.min(source.quantity, item.maxStackSize - target.quantity);
      if (movable <= 0) return;
      await tx.updateTable(table.inventoryStack).set({ quantity: target.quantity + movable, updatedAt: serverTimestamp() }).where("id", "=", target.id).execute();
      await spendInventoryStack(tx, source, movable);
      return;
    }

    if (!target) {
      await tx.updateTable(table.inventoryStack).set({ slotIndex: targetSlotIndex, updatedAt: serverTimestamp() }).where("id", "=", source.id).execute();
      return;
    }

    await tx.updateTable(table.inventoryStack).set({ slotIndex: -1, updatedAt: serverTimestamp() }).where("id", "=", source.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: sourceSlotIndex, updatedAt: serverTimestamp() }).where("id", "=", target.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: targetSlotIndex, updatedAt: serverTimestamp() }).where("id", "=", source.id).execute();
  });
}

export async function stashBoardItem(boardItemId: string, slotIndex?: number) {
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    const boardItem = boardRows.find((row) => row.id === boardItemId);
    if (!boardItem) throw new GameActionError("Board item does not exist.");
    if (gameDataIndex.producersByItemId.has(boardItem.itemDefinitionId as ItemId)) {
      throw new GameActionError("Producer lives on the board. Pause it instead of hiding its state in inventory.");
    }

    const virtualInventory = cloneInventory(inventoryRows);
    const plan = slotIndex === undefined
      ? planInventoryPlacement(save, virtualInventory, boardItem.itemDefinitionId as ItemId)
      : planExactInventorySlotPlacement(save, virtualInventory, boardItem.itemDefinitionId as ItemId, slotIndex);
    if (!plan) throw new GameActionError(slotIndex === undefined ? "Inventory is full." : "Inventory slot cannot accept this item.");

    await applyInventoryPlacementPlan(tx, plan);
    await tx.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute();
  });
}

export async function moveBoardItem(boardItemId: string, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const { save, boardRows } = await readMutableSave(tx);
    assertInsideBoard(save, x, y);

    const boardItem = boardRows.find((row) => row.id === boardItemId);
    if (!boardItem) throw new GameActionError("Board item does not exist.");
    const occupied = boardRows.find((row) => row.x === x && row.y === y && row.id !== boardItem.id);
    if (occupied) throw new GameActionError("Drop on an empty board cell or merge a valid recipe.");

    await tx.updateTable(table.boardItem).set({ x, y, updatedAt: serverTimestamp() }).where("id", "=", boardItem.id).execute();
  });
}

export async function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) throw new GameActionError("Pick two different board items to merge.");

  await db.transaction().execute(async (tx) => {
    const { boardRows } = await readMutableSave(tx);
    const source = boardRows.find((row) => row.id === sourceBoardItemId);
    const target = boardRows.find((row) => row.id === targetBoardItemId);
    if (!source || !target) throw new GameActionError("Both board items must exist.");

    const rule = resolveItemMergeRule(source.itemDefinitionId as ItemId, target.itemDefinitionId as ItemId);
    if (!rule) throw new GameActionError("No merge recipe discovered here.");

    await tx.deleteFrom(table.boardItem).where("id", "=", source.id).execute();
    await tx
      .updateTable(table.boardItem)
      .set({
        itemDefinitionId: rule.resultItemId,
        stateJson: json(createInitialBoardState(rule.resultItemId)),
        updatedAt: serverTimestamp(),
      })
      .where("id", "=", target.id)
      .execute();
  });
}

export async function produceBoardItem(boardItemId: string, activation: "single" | "exhaust" = "single"): Promise<ProducerDropResult> {
  return db.transaction().execute(async (tx) => {
    const mutable = await readMutableSave(tx);
    const producerRow = mutable.boardRows.find((row) => row.id === boardItemId);
    if (!producerRow) throw new GameActionError("Producer does not exist.");

    const producer = getProducer(producerRow.itemDefinitionId);
    if (producer.trigger !== "click") throw new GameActionError("This producer runs by itself.");

    const timestamp = Date.now();
    const state = readBoardState(producerRow);
    const producerState = { ...(createInitialBoardState(producerRow.itemDefinitionId).producer ?? {}), ...(state.producer ?? {}) };

    const mode = producer.mode ?? { type: "infinite" as const };
    const isFiniteExhaust = activation === "exhaust" && mode.type === "finite";

    if (!isFiniteExhaust && producerState.cooldownUntil && Date.parse(producerState.cooldownUntil) > timestamp) {
      throw new GameActionError("Producer is still cooling down.");
    }

    if (producerState.remainingCharges !== null && producerState.remainingCharges !== undefined && producerState.remainingCharges <= 0) {
      throw new GameActionError("Producer is empty.");
    }

    const steps = isFiniteExhaust
      ? Math.max(1, producerState.remainingCharges ?? mode.charges)
      : 1;

    const allDrops = Array.from({ length: steps }, () => rollProducerDrops(producer.drops)).flat();
    const plan = planPlacements(mutable.save, mutable.boardRows, mutable.inventoryRows, allDrops, producerRow);
    if (!plan) throw new GameActionError("Board and inventory are full.");

    const placements = await applyPlacementPlan(tx, plan);
    const nextRemainingCharges = match(mode as ProducerMode)
      .with({ type: "infinite" }, () => null)
      .with({ type: "finite" }, (finiteMode) => Math.max(0, (producerState.remainingCharges ?? finiteMode.charges) - steps))
      .exhaustive();

    const shouldDeplete = nextRemainingCharges !== null && nextRemainingCharges <= 0;
    if (shouldDeplete) {
      await depleteProducer(tx, producerRow, mode);
      return { producerBoardItemId: producerRow.id, placements };
    }

    await tx
      .updateTable(table.boardItem)
      .set({
        stateJson: json({
          ...state,
          producer: {
            ...producerState,
            cooldownUntil: new Date(timestamp + (producer.cooldownMs ?? 0)).toISOString(),
            remainingCharges: nextRemainingCharges,
          },
        } satisfies BoardItemState),
        updatedAt: serverTimestamp(),
      })
      .where("id", "=", producerRow.id)
      .execute();

    return { producerBoardItemId: producerRow.id, placements };
  });
}

export async function buildRecipe(recipeId: string, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    assertInsideBoard(save, x, y);
    if (boardRows.some((row) => row.x === x && row.y === y)) throw new GameActionError("Build target is occupied.");

    const recipe = gameDataIndex.buildRecipesById.get(recipeId as BuildRecipeId);
    if (!recipe) throw new GameActionError("Unknown build recipe.");

    const costs = [{ itemId: recipe.blueprintItemId, quantity: 1 }, ...recipe.costs];
    const inventory = inventoryRows.map((row) => ({ slotIndex: row.slotIndex, stack: { id: row.id, itemId: row.itemDefinitionId, quantity: row.quantity } }));
    if (!canPayCosts(inventory, costs)) throw new GameActionError("Inventory is missing blueprint or materials.");

    for (const cost of costs) {
      await removeInventoryItems(tx, cost.itemId, cost.quantity);
    }

    await insertBoardItem(tx, recipe.resultItemId, x, y);
  });
}
