import { P, match } from "ts-pattern";
import type {
  BuildRecipeCost,
  DropTableEntry,
  ItemId,
  ProducerMode,
  ProducerRoll,
} from "~/domains/game-data";
import { gameDataManifest } from "~/domains/game-data";
import { db, type ArkiniTransaction } from "./db";
import { table } from "./tables";
import { defaultSaveGameId } from "./save";

export interface GameView {
  save: { id: string; boardWidth: number; boardHeight: number; inventorySlots: number };
  items: Record<string, ViewItem>;
  boardItems: BoardViewItem[];
  inventory: InventorySlot[];
  buildRecipes: BuildRecipeView[];
}

export interface ViewItem {
  id: string;
  name: string;
  description: string;
  assetSrc: string;
  maxStackSize: number;
  tags: string[];
  canProduce: boolean;
  canMerge: boolean;
  producerCooldownMs: number | null;
}

export interface BoardViewItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  state: BoardItemState;
}

export interface InventorySlot {
  slotIndex: number;
  stack: { id: string; itemId: string; quantity: number } | null;
}

export interface BuildRecipeView {
  id: string;
  blueprintItemId: string;
  resultItemId: string;
  costs: BuildRecipeCost[];
  canBuild: boolean;
}

export interface ProducerDropResult {
  producerBoardItemId: string;
  drops: { boardItemId: string; itemId: string; x: number; y: number }[];
}

interface BoardItemState {
  producer?: {
    cooldownUntil?: string;
    remainingCharges?: number | null;
  };
}

class GameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameActionError";
  }
}

const json = (value: unknown) => JSON.stringify(value);
const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export async function readGameView(): Promise<GameView> {
  const [save, boardRows, inventoryRows] = await Promise.all([
    db.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
    db
      .selectFrom(table.boardItem)
      .selectAll()
      .where("saveGameId", "=", defaultSaveGameId)
      .orderBy("y")
      .orderBy("x")
      .execute(),
    db
      .selectFrom(table.inventoryStack)
      .selectAll()
      .where("saveGameId", "=", defaultSaveGameId)
      .orderBy("slotIndex")
      .execute(),
  ]);

  const inventoryMap = new Map(inventoryRows.map((stack) => [stack.slotIndex, stack]));
  const inventory = Array.from({ length: save.inventorySlots }, (_, slotIndex) => {
    const stack = inventoryMap.get(slotIndex);
    return {
      slotIndex,
      stack: stack ? { id: stack.id, itemId: stack.itemDefinitionId, quantity: stack.quantity } : null,
    };
  });

  return {
    save: {
      id: save.id,
      boardWidth: save.boardWidth,
      boardHeight: save.boardHeight,
      inventorySlots: save.inventorySlots,
    },
    items: createViewItemMap(),
    boardItems: boardRows.map((item) => ({
      id: item.id,
      itemId: item.itemDefinitionId,
      x: item.x,
      y: item.y,
      state: parseJson<BoardItemState>(item.stateJson),
    })),
    inventory,
    buildRecipes: gameDataManifest.buildRecipes.map((recipe) => ({
      id: recipe.id,
      blueprintItemId: recipe.blueprintItemId,
      resultItemId: recipe.resultItemId,
      costs: [...recipe.costs],
      canBuild: canPayCosts(inventory, [
        { itemId: recipe.blueprintItemId, quantity: 1 },
        ...recipe.costs,
      ]),
    })),
  };
}

export async function placeInventoryItem(slotIndex: number, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const [save, stack, existingBoardItem] = await Promise.all([
      tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
      tx
        .selectFrom(table.inventoryStack)
        .selectAll()
        .where("saveGameId", "=", defaultSaveGameId)
        .where("slotIndex", "=", slotIndex)
        .executeTakeFirst(),
      tx
        .selectFrom(table.boardItem)
        .select("id")
        .where("saveGameId", "=", defaultSaveGameId)
        .where("x", "=", x)
        .where("y", "=", y)
        .executeTakeFirst(),
    ]);

    assertInsideBoard(save, x, y);
    if (!stack) throw new GameActionError("Inventory slot is empty.");
    if (existingBoardItem) throw new GameActionError("Board cell is occupied.");

    await tx
      .insertInto(table.boardItem)
      .values({
        id: createId("board"),
        saveGameId: defaultSaveGameId,
        itemDefinitionId: stack.itemDefinitionId,
        x,
        y,
        stateJson: json(createInitialBoardState(stack.itemDefinitionId)),
      })
      .execute();

    if (stack.quantity <= 1) {
      await tx.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute();
      return;
    }

    await tx
      .updateTable(table.inventoryStack)
      .set({ quantity: stack.quantity - 1, updatedAt: now() })
      .where("id", "=", stack.id)
      .execute();
  });
}

export async function swapInventorySlots(sourceSlotIndex: number, targetSlotIndex: number) {
  if (sourceSlotIndex === targetSlotIndex) return;

  await db.transaction().execute(async (tx) => {
    const save = await tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow();

    if (sourceSlotIndex < 0 || targetSlotIndex < 0 || sourceSlotIndex >= save.inventorySlots || targetSlotIndex >= save.inventorySlots) {
      throw new GameActionError("Inventory slot is outside the inventory.");
    }

    const stacks = await tx
      .selectFrom(table.inventoryStack)
      .selectAll()
      .where("saveGameId", "=", defaultSaveGameId)
      .where("slotIndex", "in", [sourceSlotIndex, targetSlotIndex])
      .execute();

    const source = stacks.find((stack) => stack.slotIndex === sourceSlotIndex);
    const target = stacks.find((stack) => stack.slotIndex === targetSlotIndex);

    if (!source) throw new GameActionError("Inventory slot is empty.");

    if (!target) {
      await tx
        .updateTable(table.inventoryStack)
        .set({ slotIndex: targetSlotIndex, updatedAt: now() })
        .where("id", "=", source.id)
        .execute();
      return;
    }

    const temporarySlotIndex = -1;

    await tx
      .updateTable(table.inventoryStack)
      .set({ slotIndex: temporarySlotIndex, updatedAt: now() })
      .where("id", "=", source.id)
      .execute();

    await tx
      .updateTable(table.inventoryStack)
      .set({ slotIndex: sourceSlotIndex, updatedAt: now() })
      .where("id", "=", target.id)
      .execute();

    await tx
      .updateTable(table.inventoryStack)
      .set({ slotIndex: targetSlotIndex, updatedAt: now() })
      .where("id", "=", source.id)
      .execute();
  });
}

export async function stashBoardItem(boardItemId: string, slotIndex?: number) {
  await db.transaction().execute(async (tx) => {
    const boardItem = await tx
      .selectFrom(table.boardItem)
      .selectAll()
      .where("id", "=", boardItemId)
      .where("saveGameId", "=", defaultSaveGameId)
      .executeTakeFirst();

    if (!boardItem) throw new GameActionError("Board item does not exist.");

    if (isProducerCoolingDown(boardItem.itemDefinitionId, parseJson<BoardItemState>(boardItem.stateJson))) {
      throw new GameActionError("Producer is still cooling down.");
    }

    await addInventoryItems(tx, boardItem.itemDefinitionId, 1, slotIndex);
    await tx.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute();
  });
}

export async function moveBoardItem(boardItemId: string, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const [save, boardItem, existingBoardItem] = await Promise.all([
      tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
      tx
        .selectFrom(table.boardItem)
        .selectAll()
        .where("id", "=", boardItemId)
        .where("saveGameId", "=", defaultSaveGameId)
        .executeTakeFirst(),
      tx
        .selectFrom(table.boardItem)
        .select("id")
        .where("saveGameId", "=", defaultSaveGameId)
        .where("x", "=", x)
        .where("y", "=", y)
        .executeTakeFirst(),
    ]);

    assertInsideBoard(save, x, y);
    if (!boardItem) throw new GameActionError("Board item does not exist.");
    if (existingBoardItem && existingBoardItem.id !== boardItem.id) {
      throw new GameActionError("Drop on an empty board cell or merge matching items.");
    }

    await tx
      .updateTable(table.boardItem)
      .set({ x, y, updatedAt: now() })
      .where("id", "=", boardItem.id)
      .execute();
  });
}

export async function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) {
    throw new GameActionError("Pick two different board items to merge.");
  }

  await db.transaction().execute(async (tx) => {
    const boardItems = await tx
      .selectFrom(table.boardItem)
      .selectAll()
      .where("saveGameId", "=", defaultSaveGameId)
      .where("id", "in", [sourceBoardItemId, targetBoardItemId])
      .execute();

    const source = boardItems.find((item) => item.id === sourceBoardItemId);
    const target = boardItems.find((item) => item.id === targetBoardItemId);

    if (!source || !target) throw new GameActionError("Both board items must exist.");
    if (source.itemDefinitionId !== target.itemDefinitionId) {
      throw new GameActionError("Only identical board items can merge.");
    }

    const merge = gameDataManifest.merges.find(
      (definition) => definition.inputItemId === source.itemDefinitionId && definition.inputCount === 2,
    );

    if (!merge) throw new GameActionError("This item has no next merge level.");

    await tx.deleteFrom(table.boardItem).where("id", "=", source.id).execute();
    await tx
      .updateTable(table.boardItem)
      .set({
        itemDefinitionId: merge.outputItemId,
        stateJson: json(createInitialBoardState(merge.outputItemId)),
        updatedAt: now(),
      })
      .where("id", "=", target.id)
      .execute();
  });
}

export async function produceBoardItem(boardItemId: string): Promise<ProducerDropResult> {
  return db.transaction().execute(async (tx) => {
    const [save, boardItem, boardItems] = await Promise.all([
      tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
      tx
        .selectFrom(table.boardItem)
        .selectAll()
        .where("id", "=", boardItemId)
        .where("saveGameId", "=", defaultSaveGameId)
        .executeTakeFirst(),
      tx.selectFrom(table.boardItem).selectAll().where("saveGameId", "=", defaultSaveGameId).execute(),
    ]);

    if (!boardItem) throw new GameActionError("Producer does not exist.");

    const producer = gameDataManifest.producers.find((definition) => definition.itemId === boardItem.itemDefinitionId);
    if (!producer) throw new GameActionError("This item is not a producer.");

    const state = parseJson<BoardItemState>(boardItem.stateJson);
    const producerState = state.producer ?? createInitialBoardState(boardItem.itemDefinitionId).producer ?? {};
    const timestamp = Date.now();

    if (producerState.cooldownUntil && Date.parse(producerState.cooldownUntil) > timestamp) {
      throw new GameActionError("Producer is still cooling down.");
    }

    if (producerState.remainingCharges !== null && producerState.remainingCharges !== undefined && producerState.remainingCharges <= 0) {
      throw new GameActionError("Producer is empty.");
    }

    const drops = rollProducerDrops(producer.rolls);
    const freeCells = findFreeCellsAround(save, boardItems, boardItem.x, boardItem.y, producer.spawn.radius);

    if (freeCells.length < drops.length) {
      throw new GameActionError("Not enough free space around the producer.");
    }

    const insertedDrops: ProducerDropResult["drops"] = [];

    for (const [index, drop] of drops.entries()) {
      const cell = freeCells[index];
      const id = createId("board");
      insertedDrops.push({ boardItemId: id, itemId: drop.itemId, x: cell.x, y: cell.y });
      await tx
        .insertInto(table.boardItem)
        .values({
          id,
          saveGameId: defaultSaveGameId,
          itemDefinitionId: drop.itemId,
          x: cell.x,
          y: cell.y,
          stateJson: json(createInitialBoardState(drop.itemId)),
        })
        .execute();
    }

    const nextRemainingCharges = match(producer.mode as ProducerMode)
      .with({ type: "infinite" }, () => null)
      .with({ type: "finite" }, () => Math.max(0, (producerState.remainingCharges ?? 1) - 1))
      .exhaustive();

    const nextState: BoardItemState = {
      ...state,
      producer: {
        cooldownUntil: new Date(timestamp + producer.cooldownMs).toISOString(),
        remainingCharges: nextRemainingCharges,
      },
    };

    const shouldDeplete = nextRemainingCharges !== null && nextRemainingCharges <= 0;

    if (shouldDeplete) {
      await match(producer.mode as ProducerMode)
        .with({ type: "finite", onDepleted: "remove" }, async () => {
          await tx.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute();
        })
        .with({ type: "finite", onDepleted: { replaceWithItemId: P.string } }, async ({ onDepleted }) => {
          await tx
            .updateTable(table.boardItem)
            .set({
              itemDefinitionId: onDepleted.replaceWithItemId,
              stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)),
              updatedAt: now(),
            })
            .where("id", "=", boardItem.id)
            .execute();
        })
        .with({ type: "infinite" }, async () => undefined)
        .exhaustive();

      return { producerBoardItemId: boardItem.id, drops: insertedDrops };
    }

    await tx
      .updateTable(table.boardItem)
      .set({ stateJson: json(nextState), updatedAt: now() })
      .where("id", "=", boardItem.id)
      .execute();

    return { producerBoardItemId: boardItem.id, drops: insertedDrops };
  });
}

export async function buildRecipe(recipeId: string, x: number, y: number) {
  await db.transaction().execute(async (tx) => {
    const [save, existingBoardItem, inventoryRows] = await Promise.all([
      tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
      tx
        .selectFrom(table.boardItem)
        .select("id")
        .where("saveGameId", "=", defaultSaveGameId)
        .where("x", "=", x)
        .where("y", "=", y)
        .executeTakeFirst(),
      tx.selectFrom(table.inventoryStack).selectAll().where("saveGameId", "=", defaultSaveGameId).execute(),
    ]);

    assertInsideBoard(save, x, y);
    if (existingBoardItem) throw new GameActionError("Build target is occupied.");

    const recipe = gameDataManifest.buildRecipes.find((definition) => definition.id === recipeId);
    if (!recipe) throw new GameActionError("Unknown build recipe.");

    const costs = [{ itemId: recipe.blueprintItemId, quantity: 1 }, ...recipe.costs];
    const inventory = inventoryRows.map((row) => ({
      slotIndex: row.slotIndex,
      stack: { id: row.id, itemId: row.itemDefinitionId, quantity: row.quantity },
    }));

    if (!canPayCosts(inventory, costs)) {
      throw new GameActionError("Inventory is missing blueprint or materials.");
    }

    for (const cost of costs) {
      await removeInventoryItems(tx, cost.itemId, cost.quantity);
    }

    await tx
      .insertInto(table.boardItem)
      .values({
        id: createId("board"),
        saveGameId: defaultSaveGameId,
        itemDefinitionId: recipe.resultItemId,
        x,
        y,
        stateJson: json(createInitialBoardState(recipe.resultItemId)),
      })
      .execute();
  });
}

export async function resetDefaultSaveGame() {
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom(table.saveGame).where("id", "=", defaultSaveGameId).execute();
  });
  const { ensureDefaultSaveGame } = await import("./save");
  await ensureDefaultSaveGame();
}

function isProducerCoolingDown(itemId: string, state: BoardItemState) {
  const producer = gameDataManifest.producers.find((definition) => definition.itemId === itemId);
  if (!producer) return false;

  const cooldownUntil = state.producer?.cooldownUntil;
  return Boolean(cooldownUntil && Date.parse(cooldownUntil) > Date.now());
}

function createViewItemMap() {
  const assetById = new Map<string, (typeof gameDataManifest.assets)[number]>(gameDataManifest.assets.map((asset) => [asset.id, asset]));
  const producerByItemId = new Map(gameDataManifest.producers.map((producer) => [producer.itemId, producer]));
  const mergeIds = new Set(gameDataManifest.merges.map((merge) => merge.inputItemId));

  return Object.fromEntries(
    gameDataManifest.items.map((item) => {
      const asset = assetById.get(item.assetId);
      if (!asset) throw new Error(`Missing asset for ${item.id}`);

      return [
        item.id,
        {
          id: item.id,
          name: item.name,
          description: item.description,
          assetSrc: asset.src,
          maxStackSize: item.maxStackSize,
          tags: [...item.tags],
          canProduce: producerByItemId.has(item.id),
          canMerge: mergeIds.has(item.id),
          producerCooldownMs: producerByItemId.get(item.id)?.cooldownMs ?? null,
        } satisfies ViewItem,
      ];
    }),
  );
}

function createInitialBoardState(itemId: string): BoardItemState {
  const producer = gameDataManifest.producers.find((definition) => definition.itemId === itemId);

  if (!producer) return {};

  return {
    producer: {
      remainingCharges: match(producer.mode as ProducerMode)
        .with({ type: "infinite" }, () => null)
        .with({ type: "finite" }, (mode) => mode.charges)
        .exhaustive(),
    },
  };
}

function rollProducerDrops(rolls: readonly ProducerRoll[]) {
  const drops: { itemId: ItemId }[] = [];

  for (const roll of rolls) {
    const count = resolveQuantity(roll.count);
    const dropTable = gameDataManifest.dropTables.find((table) => table.id === roll.dropTableId);
    if (!dropTable) throw new GameActionError("Producer references a missing drop table.");

    for (let index = 0; index < count; index += 1) {
      const entry = pickWeighted(dropTable.entries);
      if (!entry.itemId) continue;

      const quantity = resolveQuantity(entry.quantity);
      for (let itemIndex = 0; itemIndex < quantity; itemIndex += 1) {
        drops.push({ itemId: entry.itemId });
      }
    }
  }

  return drops;
}

function pickWeighted(entries: readonly DropTableEntry[]) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return entries.at(-1) ?? fail("Drop table is empty.");
}

function resolveQuantity(quantity: number | { min: number; max: number }) {
  if (typeof quantity === "number") {
    return quantity;
  }

  return quantity.min + Math.floor(Math.random() * (quantity.max - quantity.min + 1));
}

function findFreeCellsAround(
  save: { boardWidth: number; boardHeight: number },
  boardItems: readonly { x: number; y: number }[],
  x: number,
  y: number,
  radius: 1,
) {
  const occupied = new Set(boardItems.map((item) => `${item.x}:${item.y}`));
  const cells: { x: number; y: number }[] = [];

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= save.boardWidth || nextY >= save.boardHeight) continue;
      if (occupied.has(`${nextX}:${nextY}`)) continue;
      cells.push({ x: nextX, y: nextY });
    }
  }

  return cells;
}

function canPayCosts(inventory: readonly InventorySlot[], costs: readonly BuildRecipeCost[]) {
  const owned = new Map<string, number>();

  for (const slot of inventory) {
    if (!slot.stack) continue;
    owned.set(slot.stack.itemId, (owned.get(slot.stack.itemId) ?? 0) + slot.stack.quantity);
  }

  return costs.every((cost) => (owned.get(cost.itemId) ?? 0) >= cost.quantity);
}

async function addInventoryItems(
  tx: ArkiniTransaction,
  itemId: string,
  quantity: number,
  preferredSlotIndex?: number,
) {
  let remaining = quantity;
  const item = gameDataManifest.items.find((definition) => definition.id === itemId);
  if (!item) throw new GameActionError("Unknown item definition.");

  const save = await tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow();
  const stacks = await tx
    .selectFrom(table.inventoryStack)
    .selectAll()
    .where("saveGameId", "=", defaultSaveGameId)
    .orderBy("slotIndex")
    .execute();

  if (preferredSlotIndex !== undefined && (preferredSlotIndex < 0 || preferredSlotIndex >= save.inventorySlots)) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }

  // Stashing always fills existing stacks first. Dragging onto any inventory
  // slot therefore behaves like one clear rule instead of a fussy slot puzzle.
  for (const stack of stacks.filter((candidate) => candidate.itemDefinitionId === itemId && candidate.quantity < item.maxStackSize)) {
    const canAdd = Math.min(remaining, item.maxStackSize - stack.quantity);
    await tx
      .updateTable(table.inventoryStack)
      .set({ quantity: stack.quantity + canAdd, updatedAt: now() })
      .where("id", "=", stack.id)
      .execute();
    remaining -= canAdd;
    if (remaining === 0) return;
  }

  const occupiedSlots = new Set(stacks.map((stack) => stack.slotIndex));

  if (preferredSlotIndex !== undefined && !occupiedSlots.has(preferredSlotIndex)) {
    const inserted = Math.min(remaining, item.maxStackSize);
    await tx
      .insertInto(table.inventoryStack)
      .values({
        id: createId("inventory"),
        saveGameId: defaultSaveGameId,
        slotIndex: preferredSlotIndex,
        itemDefinitionId: itemId,
        quantity: inserted,
      })
      .execute();
    remaining -= inserted;
    occupiedSlots.add(preferredSlotIndex);
    if (remaining === 0) return;
  }

  for (let slotIndex = 0; slotIndex < save.inventorySlots && remaining > 0; slotIndex += 1) {
    if (occupiedSlots.has(slotIndex)) continue;
    const inserted = Math.min(remaining, item.maxStackSize);
    await tx
      .insertInto(table.inventoryStack)
      .values({
        id: createId("inventory"),
        saveGameId: defaultSaveGameId,
        slotIndex,
        itemDefinitionId: itemId,
        quantity: inserted,
      })
      .execute();
    remaining -= inserted;
    occupiedSlots.add(slotIndex);
  }

  if (remaining > 0) throw new GameActionError("Inventory is full.");
}
async function removeInventoryItems(
  tx: ArkiniTransaction,
  itemId: string,
  quantity: number,
) {
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
    const nextQuantity = stack.quantity - removed;

    if (nextQuantity === 0) {
      await tx.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute();
    } else {
      await tx
        .updateTable(table.inventoryStack)
        .set({ quantity: nextQuantity, updatedAt: now() })
        .where("id", "=", stack.id)
        .execute();
    }

    remaining -= removed;
    if (remaining === 0) return;
  }

  throw new GameActionError("Inventory is missing required items.");
}

function assertInsideBoard(save: { boardWidth: number; boardHeight: number }, x: number, y: number) {
  if (x < 0 || y < 0 || x >= save.boardWidth || y >= save.boardHeight) {
    throw new GameActionError("Target cell is outside the board.");
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
