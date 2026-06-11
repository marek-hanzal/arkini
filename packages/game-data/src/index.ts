import { match } from "ts-pattern";

export type AssetId = `asset:${string}`;
export type ItemId = `item:${string}`;
export type DropTableId = `drop:${string}`;
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
  tags: readonly string[];
  sort: number;
}

export interface MergeDefinition {
  id: MergeDefinitionId;
  inputItemId: ItemId;
  inputCount: number;
  outputItemId: ItemId;
}

export interface DropTableDefinition {
  id: DropTableId;
  label: string;
  entries: readonly DropTableEntry[];
}

export type DropTableEntry =
  | {
      itemId: ItemId;
      weight: number;
      quantity: number | { min: number; max: number };
    }
  | {
      itemId: null;
      weight: number;
      quantity?: never;
    };

export interface ProducerDefinition {
  itemId: ItemId;
  cooldownMs: number;
  mode: ProducerMode;
  spawn: ProducerSpawn;
  rolls: readonly ProducerRoll[];
}

export type ProducerMode =
  | { type: "infinite" }
  | { type: "finite"; charges: number; onDepleted: "remove" | { replaceWithItemId: ItemId } };

export interface ProducerSpawn {
  type: "around_self";
  radius: 1;
  placement: "all_or_nothing";
}

export interface ProducerRoll {
  dropTableId: DropTableId;
  count: number | { min: number; max: number };
}

export interface BuildRecipeDefinition {
  id: BuildRecipeId;
  blueprintItemId: ItemId;
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
    dataVersion: number;
    board: { width: 7; height: 9 };
    inventory: { slots: number };
  };
  assets: readonly AssetDefinition[];
  items: readonly ItemDefinition[];
  merges: readonly MergeDefinition[];
  dropTables: readonly DropTableDefinition[];
  producers: readonly ProducerDefinition[];
  buildRecipes: readonly BuildRecipeDefinition[];
  startingState: {
    inventory: readonly { itemId: ItemId; quantity: number }[];
    board: readonly { itemId: ItemId; x: number; y: number }[];
  };
}

const svg = (name: string) => new URL(`./svg/${name}.svg`, import.meta.url).href;

// This file is the whole static game definition. Migrations create tables; this
// manifest defines the content that must exist after every app start. When a
// balance value or drop list changes, change this file instead of writing a
// content-only migration.
export const gameDataManifest = {
  game: {
    id: "arkini",
    title: "Arkini",
    dataVersion: 1,
    board: { width: 7, height: 9 },
    inventory: { slots: 21 },
  },
  assets: [
    { id: "asset:item-seed", kind: "item", label: "Seed", src: svg("item-seed"), sort: 10 },
    { id: "asset:item-sprout", kind: "item", label: "Sprout", src: svg("item-sprout"), sort: 20 },
    { id: "asset:item-leaf", kind: "item", label: "Leaf", src: svg("item-leaf"), sort: 30 },
    { id: "asset:item-twig", kind: "item", label: "Twig", src: svg("item-twig"), sort: 40 },
    { id: "asset:item-branch", kind: "item", label: "Branch", src: svg("item-branch"), sort: 50 },
    { id: "asset:item-log", kind: "item", label: "Log", src: svg("item-log"), sort: 60 },
    { id: "asset:item-pebble", kind: "item", label: "Pebble", src: svg("item-pebble"), sort: 70 },
    { id: "asset:item-stone", kind: "item", label: "Stone", src: svg("item-stone"), sort: 80 },
    { id: "asset:item-crystal", kind: "item", label: "Crystal", src: svg("item-crystal"), sort: 90 },
    { id: "asset:item-blueprint", kind: "item", label: "Blueprint", src: svg("item-blueprint"), sort: 100 },
    { id: "asset:item-townhall", kind: "item", label: "Town Hall", src: svg("item-townhall"), sort: 110 },
    { id: "asset:item-crate", kind: "item", label: "Crate", src: svg("item-crate"), sort: 120 },
    { id: "asset:item-water", kind: "item", label: "Water", src: svg("item-water"), sort: 130 },
    { id: "asset:ui-slot", kind: "ui", label: "Board Slot", src: svg("ui-slot"), sort: 1000 },
  ],
  items: [
    item("item:seed", "asset:item-seed", "seed", "Seed", 1, 50, "Tiny start of something suspiciously grindy.", ["material", "plant"], 10),
    item("item:sprout", "asset:item-sprout", "sprout", "Sprout", 2, 50, "A plant pretending it has a future.", ["material", "plant"], 20),
    item("item:leaf", "asset:item-leaf", "leaf", "Leaf", 3, 50, "Photosynthesis, but make it collectible.", ["material", "plant"], 30),
    item("item:twig", "asset:item-twig", "twig", "Twig", 1, 50, "Nature's disposable stick.", ["material", "wood"], 40),
    item("item:branch", "asset:item-branch", "branch", "Branch", 2, 50, "Bigger stick. Humanity is saved.", ["material", "wood"], 50),
    item("item:log", "asset:item-log", "log", "Log", 3, 50, "A tree with fewer opinions.", ["material", "wood"], 60),
    item("item:pebble", "asset:item-pebble", "pebble", "Pebble", 1, 50, "Small rock. Big destiny. Apparently.", ["material", "stone"], 70),
    item("item:stone", "asset:item-stone", "stone", "Stone", 2, 50, "Rock with self-esteem.", ["material", "stone"], 80),
    item("item:crystal", "asset:item-crystal", "crystal", "Crystal", 3, 25, "Shiny enough to justify bad decisions.", ["material", "stone", "rare"], 90),
    item("item:water", "asset:item-water", "water", "Water", 1, 50, "Liquid logistics. Somehow still your problem.", ["material", "water"], 100),
    item("item:blueprint-townhall", "asset:item-blueprint", "blueprint-townhall", "Town Hall Blueprint", 1, 5, "Consumable plan for one town hall.", ["blueprint"], 200),
    item("item:townhall-1", "asset:item-townhall", "townhall-1", "Town Hall I", 1, 1, "A tiny bureaucracy that spits out progress.", ["producer", "building", "townhall"], 300),
    item("item:townhall-2", "asset:item-townhall", "townhall-2", "Town Hall II", 2, 1, "Same bureaucracy, slightly shinier clipboard.", ["producer", "building", "townhall"], 310),
    item("item:common-crate", "asset:item-crate", "common-crate", "Common Crate", 1, 1, "A finite producer with opinions inside.", ["producer", "container"], 400),
  ],
  merges: [
    merge("merge:seed-sprout", "item:seed", "item:sprout"),
    merge("merge:sprout-leaf", "item:sprout", "item:leaf"),
    merge("merge:twig-branch", "item:twig", "item:branch"),
    merge("merge:branch-log", "item:branch", "item:log"),
    merge("merge:pebble-stone", "item:pebble", "item:stone"),
    merge("merge:stone-crystal", "item:stone", "item:crystal"),
    merge("merge:townhall-1-townhall-2", "item:townhall-1", "item:townhall-2"),
  ],
  dropTables: [
    {
      id: "drop:townhall-1",
      label: "Town Hall I drops",
      entries: [
        { itemId: "item:twig", weight: 42, quantity: 1 },
        { itemId: "item:pebble", weight: 42, quantity: 1 },
        { itemId: "item:common-crate", weight: 10, quantity: 1 },
        { itemId: "item:blueprint-townhall", weight: 6, quantity: 1 },
      ],
    },
    {
      id: "drop:townhall-2",
      label: "Town Hall II drops",
      entries: [
        { itemId: "item:branch", weight: 36, quantity: 1 },
        { itemId: "item:stone", weight: 32, quantity: 1 },
        { itemId: "item:water", weight: 18, quantity: { min: 1, max: 2 } },
        { itemId: "item:common-crate", weight: 10, quantity: 1 },
        { itemId: "item:blueprint-townhall", weight: 4, quantity: 1 },
      ],
    },
    {
      id: "drop:common-crate",
      label: "Common crate drops",
      entries: [
        { itemId: "item:seed", weight: 30, quantity: { min: 1, max: 2 } },
        { itemId: "item:twig", weight: 30, quantity: { min: 1, max: 2 } },
        { itemId: "item:pebble", weight: 30, quantity: { min: 1, max: 2 } },
        { itemId: "item:blueprint-townhall", weight: 10, quantity: 1 },
      ],
    },
  ],
  producers: [
    producer("item:townhall-1", 10_000, "drop:townhall-1", 1, { type: "infinite" }),
    producer("item:townhall-2", 8_000, "drop:townhall-2", 1, { type: "infinite" }),
    producer("item:common-crate", 1_500, "drop:common-crate", { min: 2, max: 4 }, { type: "finite", charges: 1, onDepleted: "remove" }),
  ],
  buildRecipes: [
    {
      id: "build:townhall-1",
      blueprintItemId: "item:blueprint-townhall",
      resultItemId: "item:townhall-1",
      costs: [
        { itemId: "item:twig", quantity: 4 },
        { itemId: "item:pebble", quantity: 3 },
      ],
    },
  ],
  startingState: {
    inventory: [
      { itemId: "item:blueprint-townhall", quantity: 1 },
      { itemId: "item:twig", quantity: 4 },
      { itemId: "item:pebble", quantity: 3 },
    ],
    board: [],
  },
} as const satisfies GameDataManifest;

export type GameData = typeof gameDataManifest;

export function assertGameDataManifest(manifest: GameDataManifest = gameDataManifest) {
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  const itemIds = new Set(manifest.items.map((manifestItem) => manifestItem.id));
  const dropTableIds = new Set(manifest.dropTables.map((dropTable) => dropTable.id));

  assertUnique(manifest.assets.map((asset) => asset.id), "asset ids");
  assertUnique(manifest.items.map((manifestItem) => manifestItem.id), "item ids");
  assertUnique(manifest.items.map((manifestItem) => manifestItem.code), "item codes");
  assertUnique(manifest.merges.map((mergeDefinition) => mergeDefinition.id), "merge ids");
  assertUnique(manifest.dropTables.map((dropTable) => dropTable.id), "drop table ids");
  assertUnique(manifest.producers.map((producerDefinition) => producerDefinition.itemId), "producer item ids");
  assertUnique(manifest.buildRecipes.map((recipe) => recipe.id), "build recipe ids");

  for (const manifestItem of manifest.items) {
    assert(assetIds.has(manifestItem.assetId), `${manifestItem.id} references missing asset ${manifestItem.assetId}`);
    assert(manifestItem.maxStackSize >= 1, `${manifestItem.id} must have maxStackSize >= 1`);
  }

  for (const mergeDefinition of manifest.merges) {
    assert(itemIds.has(mergeDefinition.inputItemId), `${mergeDefinition.id} references missing input ${mergeDefinition.inputItemId}`);
    assert(itemIds.has(mergeDefinition.outputItemId), `${mergeDefinition.id} references missing output ${mergeDefinition.outputItemId}`);
    assert(mergeDefinition.inputCount >= 2, `${mergeDefinition.id} must require at least two items`);
  }

  for (const dropTable of manifest.dropTables) {
    assert(dropTable.entries.length > 0, `${dropTable.id} must have entries`);
    for (const [index, entry] of dropTable.entries.entries()) {
      assert(entry.weight > 0, `${dropTable.id}[${index}] weight must be positive`);
      if (entry.itemId) {
        assert(itemIds.has(entry.itemId), `${dropTable.id}[${index}] references missing item ${entry.itemId}`);
        assertRange(entry.quantity, `${dropTable.id}[${index}] quantity`);
      }
    }
  }

  for (const producerDefinition of manifest.producers) {
    assert(itemIds.has(producerDefinition.itemId), `Producer references missing item ${producerDefinition.itemId}`);
    assert(producerDefinition.cooldownMs > 0, `${producerDefinition.itemId} cooldown must be positive`);
    for (const roll of producerDefinition.rolls) {
      assert(dropTableIds.has(roll.dropTableId), `${producerDefinition.itemId} references missing drop table ${roll.dropTableId}`);
      assertRange(roll.count, `${producerDefinition.itemId} roll count`);
    }

    match(producerDefinition.mode)
      .with({ type: "infinite" }, () => undefined)
      .with({ type: "finite" }, (mode) => {
        assert(mode.charges > 0, `${producerDefinition.itemId} finite charges must be positive`);
        if (typeof mode.onDepleted !== "string") {
          assert(itemIds.has(mode.onDepleted.replaceWithItemId), `${producerDefinition.itemId} replacement item is missing`);
        }
      })
      .exhaustive();
  }

  for (const recipe of manifest.buildRecipes) {
    assert(itemIds.has(recipe.blueprintItemId), `${recipe.id} references missing blueprint ${recipe.blueprintItemId}`);
    assert(itemIds.has(recipe.resultItemId), `${recipe.id} references missing result ${recipe.resultItemId}`);
    for (const cost of recipe.costs) {
      assert(itemIds.has(cost.itemId), `${recipe.id} references missing cost ${cost.itemId}`);
      assert(cost.quantity > 0, `${recipe.id} cost quantity must be positive`);
    }
  }

  for (const inventoryStack of manifest.startingState.inventory) {
    assert(itemIds.has(inventoryStack.itemId), `Starting inventory references missing item ${inventoryStack.itemId}`);
    assert(inventoryStack.quantity > 0, `Starting inventory quantity must be positive`);
  }

  for (const boardItem of manifest.startingState.board) {
    assert(itemIds.has(boardItem.itemId), `Starting board references missing item ${boardItem.itemId}`);
    assert(boardItem.x >= 0 && boardItem.x < manifest.game.board.width, `Starting board x is out of bounds`);
    assert(boardItem.y >= 0 && boardItem.y < manifest.game.board.height, `Starting board y is out of bounds`);
  }
}

function item(
  id: ItemId,
  assetId: AssetId,
  code: string,
  name: string,
  tier: number,
  maxStackSize: number,
  description: string,
  tags: readonly string[],
  sort: number,
): ItemDefinition {
  return { id, assetId, code, name, tier, maxStackSize, description, tags, sort };
}

function merge(id: MergeDefinitionId, inputItemId: ItemId, outputItemId: ItemId): MergeDefinition {
  return { id, inputItemId, inputCount: 2, outputItemId };
}

function producer(
  itemId: ItemId,
  cooldownMs: number,
  dropTableId: DropTableId,
  count: ProducerRoll["count"],
  mode: ProducerMode,
): ProducerDefinition {
  return {
    itemId,
    cooldownMs,
    mode,
    spawn: { type: "around_self", radius: 1, placement: "all_or_nothing" },
    rolls: [{ dropTableId, count }],
  };
}

function assertUnique(values: readonly string[], label: string) {
  assert(new Set(values).size === values.length, `Duplicate ${label}.`);
}

function assertRange(value: number | { min: number; max: number }, label: string) {
  if (typeof value === "number") {
    assert(value > 0, `${label} must be positive`);
    return;
  }

  assert(value.min > 0, `${label}.min must be positive`);
  assert(value.max >= value.min, `${label}.max must be >= min`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid Arkini game data: ${message}`);
  }
}
