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
  | { itemId: ItemId; weight: number; quantity: number | { min: number; max: number } }
  | { itemId: null; weight: number; quantity?: never };

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

// Single source of truth for static gameplay data. Migrations create storage;
// this manifest defines the current game rules and is synced on every boot.
export const gameDataManifest = {
  game: {
    id: "arkini",
    title: "Arkini",
    dataVersion: 3,
    board: { width: 7, height: 9 },
    inventory: { slots: 36 },
  },
  assets: [
    asset("asset:item-seed", "Seed", "item-seed", 10),
    asset("asset:item-sprout", "Sprout", "item-sprout", 20),
    asset("asset:item-leaf", "Leaf", "item-leaf", 30),
    asset("asset:item-twig", "Twig", "item-twig", 40),
    asset("asset:item-branch", "Branch", "item-branch", 50),
    asset("asset:item-log", "Log", "item-log", 60),
    asset("asset:item-pebble", "Pebble", "item-pebble", 70),
    asset("asset:item-stone", "Stone", "item-stone", 80),
    asset("asset:item-crystal", "Crystal", "item-crystal", 90),
    asset("asset:item-water", "Water", "item-water", 100),
    asset("asset:item-blueprint", "Blueprint", "item-blueprint", 110),
    asset("asset:item-townhall", "Town Hall", "item-townhall", 120),
    asset("asset:item-lumber-camp", "Lumber Camp", "item-lumber-camp", 130),
    asset("asset:item-quarry", "Quarry", "item-quarry", 140),
    asset("asset:item-crate", "Common Crate", "item-crate", 150),
    asset("asset:item-crate-sturdy", "Sturdy Crate", "item-crate-sturdy", 160),
    asset("asset:item-crate-rare", "Rare Crate", "item-crate-rare", 170),
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
    item("item:blueprint-lumber-camp", "asset:item-blueprint", "blueprint-lumber-camp", "Lumber Camp Blueprint", 1, 5, "Consumable plan for a wood producer.", ["blueprint"], 210),
    item("item:blueprint-quarry", "asset:item-blueprint", "blueprint-quarry", "Quarry Blueprint", 1, 5, "Consumable plan for a stone producer.", ["blueprint"], 220),

    item("item:townhall-1", "asset:item-townhall", "townhall-1", "Town Hall I", 1, 1, "A tiny bureaucracy that spits out progress.", ["producer", "building", "townhall"], 300),
    item("item:townhall-2", "asset:item-townhall", "townhall-2", "Town Hall II", 2, 1, "Same bureaucracy, slightly shinier clipboard.", ["producer", "building", "townhall"], 310),
    item("item:townhall-3", "asset:item-townhall", "townhall-3", "Town Hall III", 3, 1, "Municipal paperwork with actual momentum.", ["producer", "building", "townhall"], 320),

    item("item:lumber-camp-1", "asset:item-lumber-camp", "lumber-camp-1", "Lumber Camp I", 1, 1, "A polite machine for turning time into sticks.", ["producer", "building", "wood"], 330),
    item("item:lumber-camp-2", "asset:item-lumber-camp", "lumber-camp-2", "Lumber Camp II", 2, 1, "Still wood, but now with ambition.", ["producer", "building", "wood"], 340),
    item("item:lumber-camp-3", "asset:item-lumber-camp", "lumber-camp-3", "Lumber Camp III", 3, 1, "A compact shrine to deforestation.", ["producer", "building", "wood"], 350),

    item("item:quarry-1", "asset:item-quarry", "quarry-1", "Quarry I", 1, 1, "A hole in the ground with a business model.", ["producer", "building", "stone"], 360),
    item("item:quarry-2", "asset:item-quarry", "quarry-2", "Quarry II", 2, 1, "A deeper hole, because progress is weird.", ["producer", "building", "stone"], 370),
    item("item:quarry-3", "asset:item-quarry", "quarry-3", "Quarry III", 3, 1, "Rocks leaving the earth at startup velocity.", ["producer", "building", "stone"], 380),

    item("item:crate-1", "asset:item-crate", "crate-1", "Common Crate", 1, 1, "A finite producer with suspicious contents.", ["producer", "container"], 400),
    item("item:crate-2", "asset:item-crate-sturdy", "crate-2", "Sturdy Crate", 2, 1, "Same box, fewer disappointments.", ["producer", "container"], 410),
    item("item:crate-3", "asset:item-crate-rare", "crate-3", "Rare Crate", 3, 1, "A tiny treasure economy in a box.", ["producer", "container", "rare"], 420),
  ],
  merges: [
    merge("merge:seed-sprout", "item:seed", "item:sprout"),
    merge("merge:sprout-leaf", "item:sprout", "item:leaf"),
    merge("merge:twig-branch", "item:twig", "item:branch"),
    merge("merge:branch-log", "item:branch", "item:log"),
    merge("merge:pebble-stone", "item:pebble", "item:stone"),
    merge("merge:stone-crystal", "item:stone", "item:crystal"),
    merge("merge:townhall-1-townhall-2", "item:townhall-1", "item:townhall-2"),
    merge("merge:townhall-2-townhall-3", "item:townhall-2", "item:townhall-3"),
    merge("merge:lumber-camp-1-lumber-camp-2", "item:lumber-camp-1", "item:lumber-camp-2"),
    merge("merge:lumber-camp-2-lumber-camp-3", "item:lumber-camp-2", "item:lumber-camp-3"),
    merge("merge:quarry-1-quarry-2", "item:quarry-1", "item:quarry-2"),
    merge("merge:quarry-2-quarry-3", "item:quarry-2", "item:quarry-3"),
    merge("merge:crate-1-crate-2", "item:crate-1", "item:crate-2"),
    merge("merge:crate-2-crate-3", "item:crate-2", "item:crate-3"),
  ],
  dropTables: [
    drop("drop:townhall-1", "Town Hall I drops", [
      entry("item:blueprint-lumber-camp", 18),
      entry("item:blueprint-quarry", 18),
      entry("item:blueprint-townhall", 8),
      entry("item:twig", 22),
      entry("item:pebble", 22),
      entry("item:crate-1", 12),
    ]),
    drop("drop:townhall-2", "Town Hall II drops", [
      entry("item:blueprint-lumber-camp", 12),
      entry("item:blueprint-quarry", 12),
      entry("item:blueprint-townhall", 6),
      entry("item:branch", 20),
      entry("item:stone", 18),
      entry("item:twig", 12),
      entry("item:pebble", 12),
      entry("item:crate-1", 6),
      entry("item:crate-2", 2),
    ]),
    drop("drop:townhall-3", "Town Hall III drops", [
      entry("item:blueprint-lumber-camp", 10),
      entry("item:blueprint-quarry", 10),
      entry("item:blueprint-townhall", 7),
      entry("item:log", 18),
      entry("item:crystal", 15),
      entry("item:branch", 12),
      entry("item:stone", 12),
      entry("item:twig", 6),
      entry("item:pebble", 6),
      entry("item:crate-2", 3),
      entry("item:crate-3", 1),
    ]),
    drop("drop:lumber-camp-1", "Lumber Camp I drops", [
      entry("item:twig", 70),
      entry("item:seed", 18),
      entry("item:branch", 12),
    ]),
    drop("drop:lumber-camp-2", "Lumber Camp II drops", [
      entry("item:branch", 54),
      entry("item:twig", 22),
      entry("item:leaf", 14),
      entry("item:log", 8),
      entry("item:crate-1", 2),
    ]),
    drop("drop:lumber-camp-3", "Lumber Camp III drops", [
      entry("item:log", 48),
      entry("item:branch", 26),
      entry("item:twig", 14),
      entry("item:leaf", 8),
      entry("item:crate-2", 4),
    ]),
    drop("drop:quarry-1", "Quarry I drops", [
      entry("item:pebble", 72),
      entry("item:stone", 18),
      entry("item:crystal", 2),
      entry("item:crate-1", 8),
    ]),
    drop("drop:quarry-2", "Quarry II drops", [
      entry("item:stone", 56),
      entry("item:pebble", 22),
      entry("item:crystal", 14),
      entry("item:crate-1", 6),
      entry("item:crate-2", 2),
    ]),
    drop("drop:quarry-3", "Quarry III drops", [
      entry("item:crystal", 44),
      entry("item:stone", 30),
      entry("item:pebble", 16),
      entry("item:crate-2", 8),
      entry("item:crate-3", 2),
    ]),
    drop("drop:crate-1", "Common crate drops", [
      entry("item:seed", 25, { min: 1, max: 2 }),
      entry("item:twig", 24, { min: 1, max: 2 }),
      entry("item:pebble", 24, { min: 1, max: 2 }),
      entry("item:water", 12, { min: 1, max: 2 }),
      entry("item:blueprint-lumber-camp", 6),
      entry("item:blueprint-quarry", 6),
      entry("item:blueprint-townhall", 3),
    ]),
    drop("drop:crate-2", "Sturdy crate drops", [
      entry("item:branch", 24, { min: 1, max: 2 }),
      entry("item:stone", 24, { min: 1, max: 2 }),
      entry("item:leaf", 16, { min: 1, max: 2 }),
      entry("item:water", 12, { min: 2, max: 3 }),
      entry("item:blueprint-lumber-camp", 8),
      entry("item:blueprint-quarry", 8),
      entry("item:blueprint-townhall", 6),
      entry("item:crate-1", 2),
    ]),
    drop("drop:crate-3", "Rare crate drops", [
      entry("item:log", 26, { min: 1, max: 2 }),
      entry("item:crystal", 24, { min: 1, max: 2 }),
      entry("item:water", 18, { min: 2, max: 4 }),
      entry("item:blueprint-lumber-camp", 10),
      entry("item:blueprint-quarry", 10),
      entry("item:blueprint-townhall", 10),
      entry("item:crate-2", 2),
    ]),
  ],
  producers: [
    producer("item:townhall-1", 2_500, "drop:townhall-1", 1, { type: "infinite" }),
    producer("item:townhall-2", 1_800, "drop:townhall-2", 1, { type: "infinite" }),
    producer("item:townhall-3", 1_300, "drop:townhall-3", 1, { type: "infinite" }),
    producer("item:lumber-camp-1", 1_800, "drop:lumber-camp-1", 1, { type: "infinite" }),
    producer("item:lumber-camp-2", 1_400, "drop:lumber-camp-2", 1, { type: "infinite" }),
    producer("item:lumber-camp-3", 1_100, "drop:lumber-camp-3", 1, { type: "infinite" }),
    producer("item:quarry-1", 1_800, "drop:quarry-1", 1, { type: "infinite" }),
    producer("item:quarry-2", 1_400, "drop:quarry-2", 1, { type: "infinite" }),
    producer("item:quarry-3", 1_100, "drop:quarry-3", 1, { type: "infinite" }),
    producer("item:crate-1", 1_100, "drop:crate-1", { min: 2, max: 4 }, { type: "finite", charges: 1, onDepleted: "remove" }),
    producer("item:crate-2", 950, "drop:crate-2", { min: 3, max: 5 }, { type: "finite", charges: 1, onDepleted: "remove" }),
    producer("item:crate-3", 800, "drop:crate-3", { min: 4, max: 6 }, { type: "finite", charges: 1, onDepleted: "remove" }),
  ],
  buildRecipes: [
    build("build:townhall-1", "item:blueprint-townhall", "item:townhall-1", [
      { itemId: "item:twig", quantity: 4 },
      { itemId: "item:pebble", quantity: 3 },
    ]),
    build("build:lumber-camp-1", "item:blueprint-lumber-camp", "item:lumber-camp-1", [
      { itemId: "item:twig", quantity: 4 },
      { itemId: "item:leaf", quantity: 2 },
    ]),
    build("build:quarry-1", "item:blueprint-quarry", "item:quarry-1", [
      { itemId: "item:pebble", quantity: 4 },
      { itemId: "item:twig", quantity: 2 },
    ]),
  ],
  startingState: {
    inventory: [
      { itemId: "item:blueprint-townhall", quantity: 1 },
      { itemId: "item:blueprint-lumber-camp", quantity: 1 },
      { itemId: "item:blueprint-quarry", quantity: 1 },
      { itemId: "item:twig", quantity: 12 },
      { itemId: "item:pebble", quantity: 12 },
      { itemId: "item:leaf", quantity: 4 },
      { itemId: "item:seed", quantity: 4 },
      { itemId: "item:crate-1", quantity: 2 },
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
    assert(inventoryStack.quantity > 0, "Starting inventory quantity must be positive");
  }

  for (const boardItem of manifest.startingState.board) {
    assert(itemIds.has(boardItem.itemId), `Starting board references missing item ${boardItem.itemId}`);
    assert(boardItem.x >= 0 && boardItem.x < manifest.game.board.width, "Starting board x is out of bounds");
    assert(boardItem.y >= 0 && boardItem.y < manifest.game.board.height, "Starting board y is out of bounds");
  }
}

function asset(id: AssetId, label: string, file: string, sort: number): AssetDefinition {
  return { id, kind: "item", label, src: svg(file), sort };
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

function drop(id: DropTableId, label: string, entries: readonly DropTableEntry[]): DropTableDefinition {
  return { id, label, entries };
}

function entry(itemId: ItemId, weight: number, quantity: DropTableEntry["quantity"] = 1): DropTableEntry {
  return { itemId, weight, quantity };
}

function build(
  id: BuildRecipeId,
  blueprintItemId: ItemId,
  resultItemId: ItemId,
  costs: readonly BuildRecipeCost[],
): BuildRecipeDefinition {
  return { id, blueprintItemId, resultItemId, costs };
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
