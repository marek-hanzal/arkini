import { P, match } from "ts-pattern";
import {
  gameDataIndex,
  resolveMergeRule,
  type BuildRecipeId,
  type ItemId,
  type ProducerDefinition,
  type ProducerDrop,
  type ProducerMode,
  type Quantity,
} from "~/domains/game-data";
import { createInitialBoardState } from "./boardState";
import { json, parseJson } from "./utils/json";
import { canPayCosts } from "./gameView";
import { db, type ArkiniTransaction } from "./db";
import { defaultSaveGameId } from "./save";
import { table } from "./tables";
import type { BoardItemState, InventorySlot, ProducerDropResult, ProducerPlacement } from "./gameplayTypes";
import { GameActionError } from "./gameplayTypes";

interface SaveShape {
  boardWidth: number;
  boardHeight: number;
  inventorySlots: number;
}

type BoardRow = { id: string; itemDefinitionId: string; x: number; y: number; stateJson: string };
type InventoryRow = { id: string; itemDefinitionId: string; slotIndex: number; quantity: number };

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
      await tx.updateTable(table.inventoryStack).set({ quantity: target.quantity + movable, updatedAt: now() }).where("id", "=", target.id).execute();
      await spendInventoryStack(tx, source, movable);
      return;
    }

    if (!target) {
      await tx.updateTable(table.inventoryStack).set({ slotIndex: targetSlotIndex, updatedAt: now() }).where("id", "=", source.id).execute();
      return;
    }

    await tx.updateTable(table.inventoryStack).set({ slotIndex: -1, updatedAt: now() }).where("id", "=", source.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: sourceSlotIndex, updatedAt: now() }).where("id", "=", target.id).execute();
    await tx.updateTable(table.inventoryStack).set({ slotIndex: targetSlotIndex, updatedAt: now() }).where("id", "=", source.id).execute();
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

    await tx.updateTable(table.boardItem).set({ x, y, updatedAt: now() }).where("id", "=", boardItem.id).execute();
  });
}

export async function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) throw new GameActionError("Pick two different board items to merge.");

  await db.transaction().execute(async (tx) => {
    const { boardRows } = await readMutableSave(tx);
    const source = boardRows.find((row) => row.id === sourceBoardItemId);
    const target = boardRows.find((row) => row.id === targetBoardItemId);
    if (!source || !target) throw new GameActionError("Both board items must exist.");

    const rule = resolveMergeRule(source.itemDefinitionId as ItemId, target.itemDefinitionId as ItemId);
    if (!rule) throw new GameActionError("No merge recipe discovered here.");

    await tx.deleteFrom(table.boardItem).where("id", "=", source.id).execute();
    await tx
      .updateTable(table.boardItem)
      .set({
        itemDefinitionId: rule.resultItemId,
        stateJson: json(createInitialBoardState(rule.resultItemId)),
        updatedAt: now(),
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
    const producerState = { ...(createInitialBoardState(producerRow.itemDefinitionId, timestamp).producer ?? {}), ...(state.producer ?? {}) };

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
      .with({ type: "auto" }, () => null)
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
        updatedAt: now(),
      })
      .where("id", "=", producerRow.id)
      .execute();

    return { producerBoardItemId: producerRow.id, placements };
  });
}

export async function advanceAutoProducers(): Promise<ProducerDropResult[]> {
  return db.transaction().execute(async (tx) => {
    const mutable = await readMutableSave(tx);
    const results: ProducerDropResult[] = [];
    const timestamp = Date.now();

    for (const row of [...mutable.boardRows]) {
      const producer = gameDataIndex.producersByItemId.get(row.itemDefinitionId as ItemId);
      if (!producer || producer.trigger !== "auto") continue;
      const mode = producer.mode;
      if (!mode || mode.type !== "auto") continue;

      const state = readBoardState(row);
      const initial = createInitialBoardState(row.itemDefinitionId, timestamp).producer ?? {};
      const producerState = { ...initial, ...(state.producer ?? {}) };
      if (producerState.paused) continue;

      let autoAvailable = producerState.autoAvailable ?? mode.capacity;
      let nextDropAt = producerState.nextDropAt ? Date.parse(producerState.nextDropAt) : timestamp + mode.tickMs;
      let rechargeUntil = producerState.rechargeUntil ? Date.parse(producerState.rechargeUntil) : null;

      if (rechargeUntil !== null && rechargeUntil <= timestamp) {
        autoAvailable = mode.capacity;
        rechargeUntil = null;
        nextDropAt = timestamp + mode.tickMs;
      }

      if (autoAvailable <= 0) {
        rechargeUntil ??= timestamp + mode.rechargeMs;
        await saveProducerState(tx, row.id, state, { ...producerState, autoAvailable, rechargeUntil: new Date(rechargeUntil).toISOString() });
        continue;
      }

      let changed = false;
      let guard = 0;
      while (autoAvailable > 0 && nextDropAt <= timestamp && guard < mode.capacity) {
        guard += 1;
        const drops = rollProducerDrops(producer.drops);
        const plan = planPlacements(mutable.save, mutable.boardRows, mutable.inventoryRows, drops, row);

        if (!plan) {
          // Full storage should not eat capacity. Push the next retry a little so
          // we do not hot-loop the DB because a human made a hoarding simulator.
          nextDropAt = timestamp + 1000;
          changed = true;
          break;
        }

        const placements = await applyPlacementPlan(tx, plan);
        commitVirtualPlacements(mutable.boardRows, mutable.inventoryRows, placements);
        results.push({ producerBoardItemId: row.id, placements });
        autoAvailable -= 1;
        nextDropAt += mode.tickMs;
        changed = true;
      }

      if (autoAvailable <= 0) {
        rechargeUntil = timestamp + mode.rechargeMs;
      }

      if (changed || rechargeUntil !== null) {
        await saveProducerState(tx, row.id, state, {
          ...producerState,
          autoAvailable,
          nextDropAt: new Date(nextDropAt).toISOString(),
          rechargeUntil: rechargeUntil === null ? null : new Date(rechargeUntil).toISOString(),
        });
      }
    }

    return results;
  });
}

export async function toggleProducerPause(boardItemId: string) {
  await db.transaction().execute(async (tx) => {
    const row = await tx.selectFrom(table.boardItem).selectAll().where("id", "=", boardItemId).where("saveGameId", "=", defaultSaveGameId).executeTakeFirst();
    if (!row) throw new GameActionError("Producer does not exist.");

    const producer = getProducer(row.itemDefinitionId);
    if (producer.trigger !== "auto") throw new GameActionError("Only auto producers can be paused.");
    const mode = producer.mode;
    if (!mode || mode.type !== "auto") throw new GameActionError("Producer has no auto schedule.");

    const state = readBoardState(row);
    const producerState = { ...(createInitialBoardState(row.itemDefinitionId).producer ?? {}), ...(state.producer ?? {}) };
    const paused = !(producerState.paused ?? false);

    await saveProducerState(tx, row.id, state, {
      ...producerState,
      paused,
      nextDropAt: paused ? producerState.nextDropAt : new Date(Date.now() + mode.tickMs).toISOString(),
    });
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

async function readMutableSave(tx: ArkiniTransaction) {
  const [save, boardRows, inventoryRows] = await Promise.all([
    tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
    tx.selectFrom(table.boardItem).selectAll().where("saveGameId", "=", defaultSaveGameId).execute(),
    tx.selectFrom(table.inventoryStack).selectAll().where("saveGameId", "=", defaultSaveGameId).orderBy("slotIndex").execute(),
  ]);

  return { save, boardRows, inventoryRows };
}

function readBoardState(row: Pick<BoardRow, "stateJson">) {
  return parseJson<BoardItemState>(row.stateJson || "{}");
}

function getItem(itemId: string) {
  const item = gameDataIndex.itemsById.get(itemId as ItemId);
  if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
  return item;
}

function getProducer(itemId: string) {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) throw new GameActionError("This item is not a producer.");
  return producer;
}

function rollProducerDrops(entries: readonly ProducerDrop[]) {
  const entry = pickWeighted(entries);
  if (!entry.itemId) return [];

  const quantity = resolveQuantity(entry.quantity ?? 1);
  return Array.from({ length: quantity }, () => entry.itemId as ItemId);
}

function pickWeighted(entries: readonly ProducerDrop[]) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return entries.at(-1) ?? fail("Producer has no drops.");
}

function resolveQuantity(quantity: Quantity) {
  if (typeof quantity === "number") return quantity;
  return quantity.min + Math.floor(Math.random() * (quantity.max - quantity.min + 1));
}

interface PlacementPlan {
  board: { itemId: ItemId; x: number; y: number }[];
  inventory: InventoryPlacementPlan[];
}

type InventoryPlacementPlan =
  | { type: "update"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number }
  | { type: "insert"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number };

function planPlacements(
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

function planInventoryPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string): InventoryPlacementPlan[] | null {
  const stackPlan = planStackPlacement(inventory, itemId);
  if (stackPlan) return stackPlan;

  for (let slotIndex = 0; slotIndex < save.inventorySlots; slotIndex += 1) {
    const insertPlan = planEmptySlotPlacement(save, inventory, itemId, slotIndex);
    if (insertPlan) return insertPlan;
  }

  return null;
}

function planExactInventorySlotPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string, slotIndex: number): InventoryPlacementPlan[] | null {
  assertInsideInventory(save, slotIndex);

  const target = inventory.find((stack) => stack.slotIndex === slotIndex);
  if (!target) return planEmptySlotPlacement(save, inventory, itemId, slotIndex);
  if (target.itemDefinitionId !== itemId) return null;

  return planStackPlacement([target], itemId);
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

async function applyPlacementPlan(tx: ArkiniTransaction, plan: PlacementPlan): Promise<ProducerPlacement[]> {
  const placements: ProducerPlacement[] = [];

  for (const placement of plan.board) {
    const boardItemId = await insertBoardItem(tx, placement.itemId, placement.x, placement.y);
    placements.push({ kind: "board", itemId: placement.itemId, boardItemId, x: placement.x, y: placement.y });
  }

  for (const placement of plan.inventory) {
    if (placement.type === "update") {
      await tx.updateTable(table.inventoryStack).set({ quantity: placement.quantity, updatedAt: now() }).where("id", "=", placement.stackId).execute();
    } else {
      await tx
        .insertInto(table.inventoryStack)
        .values({
          id: placement.stackId,
          saveGameId: defaultSaveGameId,
          slotIndex: placement.slotIndex,
          itemDefinitionId: placement.itemId,
          quantity: placement.quantity,
        })
        .execute();
    }
    placements.push({ kind: "inventory", itemId: placement.itemId, slotIndex: placement.slotIndex });
  }

  return placements;
}

async function applyInventoryPlacementPlan(tx: ArkiniTransaction, plan: readonly InventoryPlacementPlan[]) {
  await applyPlacementPlan(tx, { board: [], inventory: [...plan] });
}

function commitVirtualPlacements(boardRows: BoardRow[], inventoryRows: InventoryRow[], placements: readonly ProducerPlacement[]) {
  for (const placement of placements) {
    if (placement.kind === "board") {
      boardRows.push({
        id: placement.boardItemId ?? createId("board:virtual"),
        itemDefinitionId: placement.itemId,
        x: placement.x ?? 0,
        y: placement.y ?? 0,
        stateJson: json(createInitialBoardState(placement.itemId)),
      });
      continue;
    }

    const slotIndex = placement.slotIndex ?? 0;
    const stack = inventoryRows.find((row) => row.slotIndex === slotIndex);
    if (stack && stack.itemDefinitionId === placement.itemId) {
      stack.quantity += 1;
    } else {
      inventoryRows.push({ id: createId("inventory:virtual"), itemDefinitionId: placement.itemId, slotIndex, quantity: 1 });
    }
  }
}

function cloneInventory(rows: readonly InventoryRow[]) {
  return rows.map((row) => ({ ...row }));
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

function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

async function insertBoardItem(tx: ArkiniTransaction, itemId: string, x: number, y: number) {
  const id = createId("board");
  await tx
    .insertInto(table.boardItem)
    .values({
      id,
      saveGameId: defaultSaveGameId,
      itemDefinitionId: itemId,
      x,
      y,
      stateJson: json(createInitialBoardState(itemId)),
    })
    .execute();
  return id;
}

async function spendInventoryStack(tx: ArkiniTransaction, stack: InventoryRow, quantity: number) {
  const nextQuantity = stack.quantity - quantity;
  if (nextQuantity <= 0) {
    await tx.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute();
    return;
  }

  await tx.updateTable(table.inventoryStack).set({ quantity: nextQuantity, updatedAt: now() }).where("id", "=", stack.id).execute();
}

async function removeInventoryItems(tx: ArkiniTransaction, itemId: string, quantity: number) {
  let remaining = quantity;
  const stacks = await tx
    .selectFrom(table.inventoryStack)
    .selectAll()
    .where("saveGameId", "=", defaultSaveGameId)
    .where("itemDefinitionId", "=", itemId)
    .orderBy("slotIndex")
    .execute();

  for (const stack of stacks) {
    const removed = Math.min(remaining, stack.quantity);
    await spendInventoryStack(tx, stack, removed);
    remaining -= removed;
    if (remaining === 0) return;
  }

  throw new GameActionError("Inventory is missing required items.");
}

async function saveProducerState(tx: ArkiniTransaction, boardItemId: string, state: BoardItemState, producerState: NonNullable<BoardItemState["producer"]>) {
  await tx
    .updateTable(table.boardItem)
    .set({ stateJson: json({ ...state, producer: producerState } satisfies BoardItemState), updatedAt: now() })
    .where("id", "=", boardItemId)
    .execute();
}

async function depleteProducer(tx: ArkiniTransaction, row: BoardRow, mode: ProducerMode) {
  await match(mode)
    .with({ type: "finite", onDepleted: "remove" }, async () => {
      await tx.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
    })
    .with({ type: "finite", onDepleted: { replaceWithItemId: P.string } }, async ({ onDepleted }) => {
      await tx
        .updateTable(table.boardItem)
        .set({ itemDefinitionId: onDepleted.replaceWithItemId, stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)), updatedAt: now() })
        .where("id", "=", row.id)
        .execute();
    })
    .otherwise(async () => undefined);
}

function assertInsideBoard(save: SaveShape, x: number, y: number) {
  if (x < 0 || y < 0 || x >= save.boardWidth || y >= save.boardHeight) {
    throw new GameActionError("Target cell is outside the board.");
  }
}

function assertInsideInventory(save: SaveShape, slotIndex: number) {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }
}

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function fail(message: string): never {
  throw new GameActionError(message);
}
