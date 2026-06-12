import { gameDataIndex, gameDataManifest, type ItemId } from "~/domains/game-data";
import { json, parseJson, readProducerView } from "./boardState";
import { db } from "./db";
import { defaultSaveGameId } from "./save";
import { table } from "./tables";
import type { BoardItemState, GameView, InventorySlot, ViewItem } from "./gameplayTypes";

const viewItems = createViewItemMap();

export async function readGameView(): Promise<GameView> {
  const [save, boardRows, inventoryRows] = await Promise.all([
    db.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
    db.selectFrom(table.boardItem).selectAll().where("saveGameId", "=", defaultSaveGameId).orderBy("y").orderBy("x").execute(),
    db.selectFrom(table.inventoryStack).selectAll().where("saveGameId", "=", defaultSaveGameId).orderBy("slotIndex").execute(),
  ]);

  const inventoryMap = new Map(inventoryRows.map((stack) => [stack.slotIndex, stack]));
  const inventory = Array.from({ length: save.inventorySlots }, (_, slotIndex) => {
    const stack = inventoryMap.get(slotIndex);
    return {
      slotIndex,
      stack: stack ? { id: stack.id, itemId: stack.itemDefinitionId, quantity: stack.quantity } : null,
    };
  });
  const boardItems = boardRows.map((item) => {
    const state = parseJson<BoardItemState>(item.stateJson || json({}));
    return {
      id: item.id,
      itemId: item.itemDefinitionId,
      x: item.x,
      y: item.y,
      state,
      producer: readProducerView(item.itemDefinitionId, state),
    };
  });
  const inventoryStacksByItemId = inventory.reduce<Record<string, InventorySlot[]>>((byItemId, slot) => {
    if (!slot.stack) return byItemId;
    byItemId[slot.stack.itemId] ??= [];
    byItemId[slot.stack.itemId].push(slot);
    return byItemId;
  }, {});

  return {
    save: {
      id: save.id,
      boardWidth: save.boardWidth,
      boardHeight: save.boardHeight,
      inventorySlots: save.inventorySlots,
    },
    items: viewItems,
    boardItems,
    boardItemsById: Object.fromEntries(boardItems.map((item) => [item.id, item])),
    boardItemByCellKey: Object.fromEntries(boardItems.map((item) => [`${item.x}:${item.y}`, item])),
    inventory,
    inventoryBySlotIndex: Object.fromEntries(inventory.map((slot) => [slot.slotIndex, slot])),
    inventoryStacksByItemId,
    firstEmptyInventorySlotIndex: inventory.find((slot) => !slot.stack)?.slotIndex ?? null,
    buildRecipes: gameDataIndex.buildRecipes.map((recipe) => ({
      id: recipe.id,
      blueprintItemId: recipe.blueprintItemId,
      resultItemId: recipe.resultItemId,
      costs: [...recipe.costs],
      canBuild: canPayCosts(inventory, [{ itemId: recipe.blueprintItemId, quantity: 1 }, ...recipe.costs]),
    })),
  };
}

export function canPayCosts(inventory: readonly InventorySlot[], costs: readonly { itemId: string; quantity: number }[]) {
  const owned = new Map<string, number>();
  for (const slot of inventory) {
    if (!slot.stack) continue;
    owned.set(slot.stack.itemId, (owned.get(slot.stack.itemId) ?? 0) + slot.stack.quantity);
  }

  return costs.every((cost) => (owned.get(cost.itemId) ?? 0) >= cost.quantity);
}

function createViewItemMap() {
  return Object.fromEntries(
    gameDataManifest.items.map((item) => {
      const asset = gameDataIndex.assetsById.get(item.assetId);
      if (!asset) throw new Error(`Missing asset for ${item.id}`);
      const producer = gameDataIndex.producersByItemId.get(item.id);

      return [
        item.id,
        {
          id: item.id,
          name: item.name,
          description: item.description,
          label: item.label,
          assetSrc: asset.src,
          maxStackSize: item.maxStackSize,
          tags: [...item.tags],
          canProduce: Boolean(producer),
          producerTrigger: producer?.trigger ?? null,
          canMerge: gameDataIndex.mergeableItemIds.has(item.id as ItemId),
        } satisfies ViewItem,
      ];
    }),
  );
}
