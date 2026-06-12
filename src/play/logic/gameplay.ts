import { match } from "ts-pattern";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import { resolveItemMergeRule } from "~/manifest/data/resolveItemMergeRule";
import type { BuildRecipeId, ItemId } from "~/manifest/data/manifestId";
import type { ProducerMode } from "~/manifest/data/producer";
import { createInitialBoardState, readBoardState } from "~/board/logic/boardState";
import { json } from "~/shared/json";
import { applyInventoryPlacementPlan, applyPlacementPlan } from "./applyPlacementPlan";
import { assertInsideBoard, assertInsideInventory } from "~/board/logic/gameBounds";
import { depleteProducer } from "~/producer/logic/depleteProducer";
import { getItem, getProducer } from "./gameDefinitionLookup";
import { insertBoardItem } from "~/board/logic/boardItemStore";
import { readMutableSave } from "./readMutableSave";
import { removeInventoryItems, spendInventoryStack } from "~/inventory/logic/inventoryStackStore";
import { rollProducerDrops } from "~/producer/logic/rollProducerDrops";
import { localTimestamp } from "./localTimestamp";
import { canPayCosts } from "./canPayCosts";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import type { BoardItemState, ProducerDropResult } from "./playTypes";
import { GameActionError } from "./playTypes";
import {
  BuildRecipeInputSchema,
  MergeBoardItemsInputSchema,
  MoveBoardItemInputSchema,
  PlaceInventoryItemInputSchema,
  ProduceBoardItemInputSchema,
  StashBoardItemInputSchema,
  SwapInventorySlotsInputSchema,
} from "./gameActionSchemas";
import {
  cloneInventory,
  planExactInventorySlotPlacement,
  planInventoryPlacement,
  planPlacements,
} from "~/inventory/logic/planning";

export async function placeInventoryItem(slotIndex: number, x: number, y: number) {
  const input = PlaceInventoryItemInputSchema.parse({ slotIndex, x, y });
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    assertInsideBoard(save, input.x, input.y);

    const stack = inventoryRows.find((row) => row.slotIndex === input.slotIndex);
    if (!stack) throw new GameActionError("Inventory slot is empty.");
    if (boardRows.some((row) => row.x === input.x && row.y === input.y)) throw new GameActionError("Board cell is occupied.");

    await insertBoardItem(tx, stack.itemDefinitionId, input.x, input.y);
    await spendInventoryStack(tx, stack, 1);
  });
}

export async function swapInventorySlots(sourceSlotIndex: number, targetSlotIndex: number) {
  const input = SwapInventorySlotsInputSchema.parse({ sourceSlotIndex, targetSlotIndex });
  if (input.sourceSlotIndex === input.targetSlotIndex) return;

  await db.transaction().execute(async (tx) => {
    const { save, inventoryRows } = await readMutableSave(tx);
    assertInsideInventory(save, input.sourceSlotIndex);
    assertInsideInventory(save, input.targetSlotIndex);

    const source = inventoryRows.find((row) => row.slotIndex === input.sourceSlotIndex);
    const target = inventoryRows.find((row) => row.slotIndex === input.targetSlotIndex);
    if (!source) throw new GameActionError("Inventory slot is empty.");

    // Same item stacks combine before they swap. This keeps inventory as storage,
    // not a little shuffling minigame from a cursed accounting department.
    if (target && target.itemDefinitionId === source.itemDefinitionId) {
      const item = getItem(source.itemDefinitionId);
      const movable = Math.min(source.quantity, item.maxStackSize - target.quantity);
      if (movable <= 0) return;
      await tx.updateTable(table.inventoryStack).set({ quantity: target.quantity + movable, updatedAt: localTimestamp() }).where("id", "=", target.id).execute();
      await spendInventoryStack(tx, source, movable);
      return;
    }

    if (!target) {
      await tx.updateTable(table.inventoryStack).set({ slotIndex: input.targetSlotIndex, updatedAt: localTimestamp() }).where("id", "=", source.id).execute();
      return;
    }

    await tx.updateTable(table.inventoryStack).set({ slotIndex: -1, updatedAt: localTimestamp() }).where("id", "=", source.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: input.sourceSlotIndex, updatedAt: localTimestamp() }).where("id", "=", target.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: input.targetSlotIndex, updatedAt: localTimestamp() }).where("id", "=", source.id).execute();
  });
}

export async function stashBoardItem(boardItemId: string, slotIndex?: number) {
  const input = StashBoardItemInputSchema.parse({ boardItemId, slotIndex });
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    const boardItem = boardRows.find((row) => row.id === input.boardItemId);
    if (!boardItem) throw new GameActionError("Board item does not exist.");
    if (gameDataIndex.producersByItemId.has(boardItem.itemDefinitionId as ItemId)) {
      throw new GameActionError("Producer lives on the board. Pause it instead of hiding its state in inventory.");
    }

    const virtualInventory = cloneInventory(inventoryRows);
    const plan = input.slotIndex === undefined
      ? planInventoryPlacement(save, virtualInventory, boardItem.itemDefinitionId as ItemId)
      : planExactInventorySlotPlacement(save, virtualInventory, boardItem.itemDefinitionId as ItemId, input.slotIndex);
    if (!plan) throw new GameActionError(input.slotIndex === undefined ? "Inventory is full." : "Inventory slot cannot accept this item.");

    await applyInventoryPlacementPlan(tx, plan);
    await tx.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute();
  });
}

export async function moveBoardItem(boardItemId: string, x: number, y: number) {
  const input = MoveBoardItemInputSchema.parse({ boardItemId, x, y });
  await db.transaction().execute(async (tx) => {
    const { save, boardRows } = await readMutableSave(tx);
    assertInsideBoard(save, input.x, input.y);

    const boardItem = boardRows.find((row) => row.id === input.boardItemId);
    if (!boardItem) throw new GameActionError("Board item does not exist.");
    const occupied = boardRows.find((row) => row.x === input.x && row.y === input.y && row.id !== boardItem.id);
    if (occupied) throw new GameActionError("Drop on an empty board cell or merge a valid recipe.");

    await tx.updateTable(table.boardItem).set({ x: input.x, y: input.y, updatedAt: localTimestamp() }).where("id", "=", boardItem.id).execute();
  });
}

export async function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
  const input = MergeBoardItemsInputSchema.parse({ sourceBoardItemId, targetBoardItemId });
  if (input.sourceBoardItemId === input.targetBoardItemId) throw new GameActionError("Pick two different board items to merge.");

  await db.transaction().execute(async (tx) => {
    const { boardRows } = await readMutableSave(tx);
    const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
    const target = boardRows.find((row) => row.id === input.targetBoardItemId);
    if (!source || !target) throw new GameActionError("Both board items must exist.");

    const rule = resolveItemMergeRule(source.itemDefinitionId as ItemId, target.itemDefinitionId as ItemId);
    if (!rule) throw new GameActionError("No merge recipe discovered here.");

    await tx.deleteFrom(table.boardItem).where("id", "=", source.id).execute();
    await tx
      .updateTable(table.boardItem)
      .set({
        itemDefinitionId: rule.resultItemId,
        stateJson: json(createInitialBoardState(rule.resultItemId)),
        updatedAt: localTimestamp(),
      })
      .where("id", "=", target.id)
      .execute();
  });
}

export async function produceBoardItem(boardItemId: string, activation: "single" | "exhaust" = "single"): Promise<ProducerDropResult> {
  const input = ProduceBoardItemInputSchema.parse({ boardItemId, activation });
  return db.transaction().execute(async (tx) => {
    const mutable = await readMutableSave(tx);
    const producerRow = mutable.boardRows.find((row) => row.id === input.boardItemId);
    if (!producerRow) throw new GameActionError("Producer does not exist.");

    const producer = getProducer(producerRow.itemDefinitionId);
    if (producer.trigger !== "click") throw new GameActionError("This producer runs by itself.");

    const timestamp = Date.now();
    const state = readBoardState(producerRow);
    const producerState = { ...(createInitialBoardState(producerRow.itemDefinitionId).producer ?? {}), ...(state.producer ?? {}) };

    const mode = producer.mode ?? { type: "infinite" as const };
    const isFiniteExhaust = input.activation === "exhaust" && mode.type === "finite";

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
      const depletion = await depleteProducer(tx, producerRow, mode);
      return { producerBoardItemId: producerRow.id, placements, depletion };
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
        updatedAt: localTimestamp(),
      })
      .where("id", "=", producerRow.id)
      .execute();

    return { producerBoardItemId: producerRow.id, placements, depletion: null };
  });
}

export async function buildRecipe(recipeId: string, x: number, y: number) {
  const input = BuildRecipeInputSchema.parse({ recipeId, x, y });
  await db.transaction().execute(async (tx) => {
    const { save, boardRows, inventoryRows } = await readMutableSave(tx);
    assertInsideBoard(save, input.x, input.y);
    if (boardRows.some((row) => row.x === input.x && row.y === input.y)) throw new GameActionError("Build target is occupied.");

    const recipe = gameDataIndex.buildRecipesById.get(input.recipeId as BuildRecipeId);
    if (!recipe) throw new GameActionError("Unknown build recipe.");

    const costs = [{ itemId: recipe.blueprintItemId, quantity: 1 }, ...recipe.costs];
    const inventory = inventoryRows.map((row) => ({ slotIndex: row.slotIndex, stack: { id: row.id, itemId: row.itemDefinitionId, quantity: row.quantity } }));
    if (!canPayCosts(inventory, costs)) throw new GameActionError("Inventory is missing blueprint or materials.");

    for (const cost of costs) {
      await removeInventoryItems(tx, cost.itemId, cost.quantity);
    }

    await insertBoardItem(tx, recipe.resultItemId, input.x, input.y);
  });
}
