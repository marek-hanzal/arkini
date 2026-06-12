import { match } from "ts-pattern";
import { gameDataManifest } from "./manifest";
import { parseGameDataManifest } from "./schema";

export { gameDataManifest } from "./manifest";

export type AssetId = `asset:${string}`;
export type ItemId = `item:${string}`;
export type BuildRecipeId = `build:${string}`;
export type MergeDefinitionId = `merge:${string}`;

export interface AssetDefinition {
  id: AssetId;
  kind: "item" | "ui";
  label: string;
  src: string;
  sort: number;
}

export interface ItemDefinition {
  id: ItemId;
  assetId: AssetId;
  code: string;
  name: string;
  tier: number;
  maxStackSize: number;
  description: string;
  label?: string;
  tags: readonly string[];
  sort: number;
  merge?: readonly ItemMergeRule[];
  producer?: ProducerDefinition;
  build?: ItemBuildRecipe;
}

export interface ItemMergeRule {
  id: MergeDefinitionId;
  withItemId: ItemId;
  resultItemId: ItemId;
  inputCount?: 2;
  secret?: boolean;
}

export interface ProducerDefinition {
  trigger: "click";
  placement: "board_then_inventory";
  drops: readonly ProducerDrop[];
  cooldownMs?: number;
  mode?: ProducerMode;
  doubleClickBehavior?: "exhaust";
}

export type ProducerMode =
  | { type: "infinite" }
  | { type: "finite"; charges: number; onDepleted: "remove" | { replaceWithItemId: ItemId } };

export type ProducerDrop =
  | { itemId: ItemId; weight: number; quantity?: Quantity }
  | { itemId: null; weight: number; quantity?: never };

export type Quantity = number | { min: number; max: number };

export interface ItemBuildRecipe {
  id: BuildRecipeId;
  resultItemId: ItemId;
  costs: readonly BuildRecipeCost[];
}

export interface BuildRecipeCost {
  itemId: ItemId;
  quantity: number;
}

export interface GameDataManifest {
  game: {
    id: "arkini";
    title: "Arkini";
    board: { width: 7; height: 9 };
    inventory: { slots: number };
  };
  assets: readonly AssetDefinition[];
  items: readonly ItemDefinition[];
  startingState: {
    inventory: readonly { itemId: ItemId; quantity: number }[];
    board: readonly { itemId: ItemId; x: number; y: number }[];
  };
}

export const gameDataIndex = createGameDataIndex(gameDataManifest);

export function assertGameDataManifest(manifest: GameDataManifest) {
  parseGameDataManifest(manifest);

  const assetIds = new Set<AssetId>();
  const itemIds = new Set<ItemId>();
  const mergeIds = new Set<MergeDefinitionId>();
  const buildIds = new Set<BuildRecipeId>();
  const mergePairs = new Set<string>();

  for (const assetDefinition of manifest.assets) {
    assertUnique(assetIds, assetDefinition.id, "asset");
  }

  for (const itemDefinition of manifest.items) {
    assertUnique(itemIds, itemDefinition.id, "item");
    assert(assetIds.has(itemDefinition.assetId), `${itemDefinition.id} references missing asset ${itemDefinition.assetId}`);
  }

  for (const itemDefinition of manifest.items) {
    for (const rule of itemDefinition.merge ?? []) {
      assertUnique(mergeIds, rule.id, "merge");
      assert(itemIds.has(rule.withItemId), `${rule.id} references missing merge input ${rule.withItemId}`);
      assert(itemIds.has(rule.resultItemId), `${rule.id} references missing merge output ${rule.resultItemId}`);
      assertUnique(mergePairs, pairKey(itemDefinition.id, rule.withItemId), "merge pair");
    }

    if (itemDefinition.build) {
      assertUnique(buildIds, itemDefinition.build.id, "build recipe");
      assert(itemIds.has(itemDefinition.build.resultItemId), `${itemDefinition.build.id} references missing build result`);
      for (const costDefinition of itemDefinition.build.costs) {
        assert(itemIds.has(costDefinition.itemId), `${itemDefinition.build.id} references missing cost ${costDefinition.itemId}`);
      }
    }

    assertProducerDefinition(itemDefinition, itemIds);
  }

  assertStartingState(manifest, itemIds);
}

function createGameDataIndex(manifest: GameDataManifest) {
  const assetsById = new Map(manifest.assets.map((assetDefinition) => [assetDefinition.id, assetDefinition]));
  const itemsById = new Map(manifest.items.map((itemDefinition) => [itemDefinition.id, itemDefinition]));
  const mergeRulesByPair = new Map<string, ItemMergeRule & { sourceItemId: ItemId }>();
  const merges = manifest.items.flatMap((itemDefinition) =>
    (itemDefinition.merge ?? []).map((rule) => ({ ...rule, sourceItemId: itemDefinition.id })),
  );

  for (const rule of merges) {
    mergeRulesByPair.set(pairKey(rule.sourceItemId, rule.withItemId), rule);
  }

  const buildRecipes = manifest.items.flatMap((itemDefinition) =>
    itemDefinition.build ? [{ ...itemDefinition.build, blueprintItemId: itemDefinition.id }] : [],
  );
  const buildRecipesById = new Map(buildRecipes.map((recipe) => [recipe.id, recipe]));
  const producersByItemId = new Map(
    manifest.items.flatMap((itemDefinition) => itemDefinition.producer ? [[itemDefinition.id, itemDefinition.producer] as const] : []),
  );

  return {
    assetsById,
    itemsById,
    merges,
    mergeRulesByPair,
    mergeableItemIds: new Set(merges.flatMap((rule) => [rule.sourceItemId, rule.withItemId])),
    buildRecipes,
    buildRecipesById,
    producersByItemId,
  };
}

export function resolveMergeRule(sourceItemId: ItemId, targetItemId: ItemId) {
  return gameDataIndex.mergeRulesByPair.get(pairKey(sourceItemId, targetItemId)) ?? null;
}

export function pairKey(first: ItemId | string, second: ItemId | string) {
  return [first, second].sort().join("+");
}

function assertProducerDefinition(itemDefinition: ItemDefinition, itemIds: Set<ItemId>) {
  const producer = itemDefinition.producer;
  if (!producer) return;

  assert(Boolean(producer.cooldownMs), `${itemDefinition.id} click producer must define cooldownMs`);
  assert(producer.drops.length > 0, `${itemDefinition.id} producer must have drops`);
  for (const entry of producer.drops) {
    assert(entry.weight > 0, `${itemDefinition.id} producer drop weight must be positive`);
    if (entry.itemId) {
      assert(itemIds.has(entry.itemId), `${itemDefinition.id} drops missing item ${entry.itemId}`);
    }
    if (entry.quantity !== undefined) assertQuantity(entry.quantity, `${itemDefinition.id} drop quantity`);
  }

  match(producer.mode ?? { type: "infinite" as const })
    .with({ type: "infinite" }, () => undefined)
    .with({ type: "finite" }, (mode) => {
      assert(mode.charges > 0, `${itemDefinition.id} finite charges must be positive`);
      if (typeof mode.onDepleted !== "string") {
        assert(itemIds.has(mode.onDepleted.replaceWithItemId), `${itemDefinition.id} replacement item is missing`);
      }
    })
    .exhaustive();
}

function assertStartingState(manifest: GameDataManifest, itemIds: Set<ItemId>) {
  assert(manifest.startingState.inventory.length <= manifest.game.inventory.slots, "Starting inventory has more stacks than available slots");
  for (const stack of manifest.startingState.inventory) {
    assert(itemIds.has(stack.itemId), `Starting inventory references missing ${stack.itemId}`);
    const itemDefinition = itemsByIdOrThrow(itemIds, manifest, stack.itemId);
    assert(stack.quantity > 0, `Starting inventory ${stack.itemId} quantity must be positive`);
    assert(stack.quantity <= itemDefinition.maxStackSize, `Starting inventory ${stack.itemId} exceeds max stack size`);
  }

  const occupiedStartingCells = new Set<string>();
  for (const boardItem of manifest.startingState.board) {
    assert(itemIds.has(boardItem.itemId), `Starting board references missing ${boardItem.itemId}`);
    assert(boardItem.x >= 0 && boardItem.y >= 0 && boardItem.x < manifest.game.board.width && boardItem.y < manifest.game.board.height, `Starting board item ${boardItem.itemId} is outside the board`);
    assertUnique(occupiedStartingCells, `${boardItem.x}:${boardItem.y}`, "starting board cell");
  }
}

function assertUnique<T>(set: Set<T>, value: T, label: string) {
  assert(!set.has(value), `Duplicate ${label}: ${String(value)}`);
  set.add(value);
}

function assertQuantity(quantity: Quantity, label: string) {
  if (typeof quantity === "number") {
    assert(quantity > 0, `${label} must be positive`);
    return;
  }
  assert(quantity.min > 0 && quantity.max >= quantity.min, `${label} range is invalid`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function itemsByIdOrThrow(itemIds: Set<ItemId>, manifest: GameDataManifest, itemId: ItemId) {
  assert(itemIds.has(itemId), `Unknown item ${itemId}`);
  const itemDefinition = manifest.items.find((item) => item.id === itemId);
  assert(itemDefinition, `Unknown item ${itemId}`);
  return itemDefinition;
}
