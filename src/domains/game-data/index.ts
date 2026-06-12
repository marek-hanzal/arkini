import { match } from "ts-pattern";
import { parseGameDataManifest } from "./schema";

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
  trigger: "click" | "auto";
  placement: "board_then_inventory";
  drops: readonly ProducerDrop[];
  cooldownMs?: number;
  mode?: ProducerMode;
  doubleClickBehavior?: "exhaust";
}

export type ProducerMode =
  | { type: "infinite" }
  | { type: "finite"; charges: number; onDepleted: "remove" | { replaceWithItemId: ItemId } }
  | {
      type: "auto";
      tickMs: number;
      capacity: number;
      rechargeMs: number;
      enabledByDefault: boolean;
    };

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

const svg = (name: string) => new URL(`./svg/${name}.svg`, import.meta.url).href;

// One manifest owns the gameplay shape. Items are not passive rows anymore:
// optional item behavior defines merges, producers, and build recipes in the
// same place as the visual identity. Data first, glue code second. Miracles.
export const gameDataManifest = {
  game: {
    id: "arkini",
    title: "Arkini",
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
    item("item:seed", "asset:item-seed", "seed", "Seed", 1, 50, "Tiny start of something suspiciously grindy.", ["material", "plant"], 10, {
      merge: [same("merge:seed-seed-sprout", "item:seed", "item:sprout")],
    }),
    item("item:sprout", "asset:item-sprout", "sprout", "Sprout", 2, 50, "A plant pretending it has a future.", ["material", "plant"], 20, {
      merge: [same("merge:sprout-sprout-leaf", "item:sprout", "item:leaf")],
    }),
    item("item:leaf", "asset:item-leaf", "leaf", "Leaf", 3, 50, "Photosynthesis, but make it collectible.", ["material", "plant"], 30),
    item("item:twig", "asset:item-twig", "twig", "Twig", 1, 50, "Nature's disposable stick.", ["material", "wood"], 40, {
      merge: [
        same("merge:twig-twig-branch", "item:twig", "item:branch"),
        combo("merge:twig-water-sprout", "item:water", "item:sprout", true),
      ],
    }),
    item("item:branch", "asset:item-branch", "branch", "Branch", 2, 50, "Bigger stick. Humanity is saved.", ["material", "wood"], 50, {
      merge: [same("merge:branch-branch-log", "item:branch", "item:log")],
    }),
    item("item:log", "asset:item-log", "log", "Log", 3, 50, "A tree with fewer opinions.", ["material", "wood"], 60),
    item("item:pebble", "asset:item-pebble", "pebble", "Pebble", 1, 50, "Small rock. Big destiny. Apparently.", ["material", "stone"], 70, {
      merge: [same("merge:pebble-pebble-stone", "item:pebble", "item:stone")],
    }),
    item("item:stone", "asset:item-stone", "stone", "Stone", 2, 50, "Rock with self-esteem.", ["material", "stone"], 80, {
      merge: [
        same("merge:stone-stone-crystal", "item:stone", "item:crystal"),
        combo("merge:stone-water-crystal", "item:water", "item:crystal", true),
      ],
    }),
    item("item:crystal", "asset:item-crystal", "crystal", "Crystal", 3, 25, "Shiny enough to justify bad decisions.", ["material", "stone", "rare"], 90),
    item("item:water", "asset:item-water", "water", "Water", 1, 50, "Liquid logistics. Somehow still your problem.", ["material", "water"], 100),

    item("item:blueprint-townhall", "asset:item-blueprint", "blueprint-townhall", "Town Hall Blueprint", 1, 5, "Consumable plan for one town hall.", ["blueprint"], 200, {
      build: build("build:townhall", "item:townhall-1", [cost("item:twig", 2), cost("item:pebble", 2)]),
    }),
    item("item:blueprint-lumber-camp", "asset:item-blueprint", "blueprint-lumber-camp", "Lumber Camp Blueprint", 1, 5, "Consumable plan for a wood producer.", ["blueprint"], 210, {
      build: build("build:lumber-camp", "item:lumber-camp-1", [cost("item:twig", 4), cost("item:branch", 1)]),
    }),
    item("item:blueprint-quarry", "asset:item-blueprint", "blueprint-quarry", "Quarry Blueprint", 1, 5, "Consumable plan for a stone producer.", ["blueprint"], 220, {
      build: build("build:quarry", "item:quarry-1", [cost("item:pebble", 4), cost("item:stone", 1)]),
    }),

    item("item:townhall-1", "asset:item-townhall", "townhall-1", "Town Hall I", 1, 1, "A tiny bureaucracy that spits out progress.", ["producer", "building", "townhall"], 300, {
      label: "1",
      merge: [same("merge:townhall-1-townhall-2", "item:townhall-1", "item:townhall-2")],
      producer: clickProducer(3500, drops([
        drop("item:blueprint-lumber-camp", 28),
        drop("item:blueprint-quarry", 28),
        drop("item:blueprint-townhall", 18),
        drop("item:water", 18),
        drop("item:crate-1", 8),
      ])),
    }),
    item("item:townhall-2", "asset:item-townhall", "townhall-2", "Town Hall II", 2, 1, "Same bureaucracy, slightly shinier clipboard.", ["producer", "building", "townhall"], 310, {
      label: "2",
      merge: [same("merge:townhall-2-townhall-3", "item:townhall-2", "item:townhall-3")],
      producer: clickProducer(3000, drops([
        drop("item:blueprint-lumber-camp", 18),
        drop("item:blueprint-quarry", 18),
        drop("item:blueprint-townhall", 12),
        drop("item:water", 18),
        drop("item:crate-1", 24),
        drop("item:crate-2", 10),
      ])),
    }),
    item("item:townhall-3", "asset:item-townhall", "townhall-3", "Town Hall III", 3, 1, "Municipal paperwork with actual momentum.", ["producer", "building", "townhall"], 320, {
      label: "3",
      producer: clickProducer(2500, drops([
        drop("item:blueprint-lumber-camp", 12),
        drop("item:blueprint-quarry", 12),
        drop("item:blueprint-townhall", 10),
        drop("item:water", 18),
        drop("item:crate-1", 16),
        drop("item:crate-2", 24),
        drop("item:crate-3", 8),
      ])),
    }),

    item("item:lumber-camp-1", "asset:item-lumber-camp", "lumber-camp-1", "Lumber Camp I", 1, 1, "A polite machine for turning time into sticks.", ["producer", "building", "wood"], 330, {
      label: "1",
      merge: [same("merge:lumber-camp-1-lumber-camp-2", "item:lumber-camp-1", "item:lumber-camp-2")],
      producer: clickProducer(5000, drops([drop("item:twig", 70), drop("item:branch", 25), empty(5)])),
    }),
    item("item:lumber-camp-2", "asset:item-lumber-camp", "lumber-camp-2", "Lumber Camp II", 2, 1, "Still wood, but now with ambition.", ["producer", "building", "wood"], 340, {
      label: "2",
      merge: [same("merge:lumber-camp-2-lumber-camp-3", "item:lumber-camp-2", "item:lumber-camp-3")],
      producer: clickProducer(4500, drops([drop("item:twig", 30), drop("item:branch", 55), drop("item:log", 15)])),
    }),
    item("item:lumber-camp-3", "asset:item-lumber-camp", "lumber-camp-3", "Lumber Camp III", 3, 1, "A compact shrine to deforestation.", ["producer", "building", "wood"], 350, {
      label: "3",
      producer: clickProducer(4000, drops([drop("item:branch", 40), drop("item:log", 55), empty(5)])),
    }),

    item("item:quarry-1", "asset:item-quarry", "quarry-1", "Quarry I", 1, 1, "A hole in the ground with a business model.", ["producer", "building", "stone"], 360, {
      label: "1",
      merge: [same("merge:quarry-1-quarry-2", "item:quarry-1", "item:quarry-2")],
      producer: clickProducer(5500, drops([drop("item:pebble", 72), drop("item:stone", 23), empty(5)])),
    }),
    item("item:quarry-2", "asset:item-quarry", "quarry-2", "Quarry II", 2, 1, "A deeper hole, because progress is weird.", ["producer", "building", "stone"], 370, {
      label: "2",
      merge: [same("merge:quarry-2-quarry-3", "item:quarry-2", "item:quarry-3")],
      producer: clickProducer(5000, drops([drop("item:pebble", 30), drop("item:stone", 55), drop("item:crystal", 15)])),
    }),
    item("item:quarry-3", "asset:item-quarry", "quarry-3", "Quarry III", 3, 1, "Rocks leaving the earth at startup velocity.", ["producer", "building", "stone"], 380, {
      label: "3",
      producer: clickProducer(4500, drops([drop("item:stone", 44), drop("item:crystal", 51), empty(5)])),
    }),

    item("item:crate-1", "asset:item-crate", "crate-1", "Common Crate", 1, 1, "A finite producer with suspicious contents.", ["producer", "container"], 400, {
      merge: [same("merge:crate-1-crate-2", "item:crate-1", "item:crate-2")],
      producer: {
        ...clickProducer(900, drops([drop("item:twig", 35), drop("item:pebble", 35), drop("item:water", 15), drop("item:seed", 15)]), { type: "finite", charges: 3, onDepleted: "remove" }),
        doubleClickBehavior: "exhaust",
      },
    }),
    item("item:crate-2", "asset:item-crate-sturdy", "crate-2", "Sturdy Crate", 2, 1, "Same box, fewer disappointments.", ["producer", "container"], 410, {
      merge: [same("merge:crate-2-crate-3", "item:crate-2", "item:crate-3")],
      producer: {
        ...clickProducer(900, drops([drop("item:branch", 35), drop("item:stone", 35), drop("item:water", 15), drop("item:crate-1", 15)]), { type: "finite", charges: 4, onDepleted: "remove" }),
        doubleClickBehavior: "exhaust",
      },
    }),
    item("item:crate-3", "asset:item-crate-rare", "crate-3", "Rare Crate", 3, 1, "A tiny treasure economy in a box.", ["producer", "container", "rare"], 420, {
      producer: {
        ...clickProducer(900, drops([drop("item:log", 30), drop("item:crystal", 30), drop("item:crate-2", 20), drop("item:water", 20)]), { type: "finite", charges: 5, onDepleted: "remove" }),
        doubleClickBehavior: "exhaust",
      },
    }),
  ],
  startingState: {
    inventory: [
      { itemId: "item:blueprint-townhall", quantity: 1 },
      { itemId: "item:blueprint-lumber-camp", quantity: 1 },
      { itemId: "item:blueprint-quarry", quantity: 1 },
      { itemId: "item:twig", quantity: 8 },
      { itemId: "item:pebble", quantity: 8 },
      { itemId: "item:water", quantity: 4 },
    ],
    board: [
      { itemId: "item:townhall-1", x: 3, y: 4 },
      { itemId: "item:lumber-camp-1", x: 1, y: 4 },
      { itemId: "item:quarry-1", x: 5, y: 4 },
    ],
  },
} satisfies GameDataManifest;

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

    const producer = itemDefinition.producer;
    if (!producer) continue;
    assert(producer.trigger !== "click" || Boolean(producer.cooldownMs), `${itemDefinition.id} click producer must define cooldownMs`);
    assert(producer.trigger !== "auto" || producer.mode?.type === "auto", `${itemDefinition.id} auto producer must define auto mode`);
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
      .with({ type: "auto" }, (mode) => {
        assert(producer.trigger === "auto", `${itemDefinition.id} auto mode requires auto trigger`);
        assert(mode.tickMs > 0, `${itemDefinition.id} auto tick must be positive`);
        assert(mode.capacity > 0, `${itemDefinition.id} auto capacity must be positive`);
        assert(mode.rechargeMs > 0, `${itemDefinition.id} auto recharge must be positive`);
      })
      .exhaustive();
  }

  for (const stack of manifest.startingState.inventory) {
    assert(itemIds.has(stack.itemId), `Starting inventory references missing ${stack.itemId}`);
  }

  for (const boardItem of manifest.startingState.board) {
    assert(itemIds.has(boardItem.itemId), `Starting board references missing ${boardItem.itemId}`);
    assert(boardItem.x < manifest.game.board.width && boardItem.y < manifest.game.board.height, `Starting board item ${boardItem.itemId} is outside the board`);
  }
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

function asset(id: AssetId, label: string, fileName: string, sort: number): AssetDefinition {
  return { id, kind: "item", label, src: svg(fileName), sort };
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
  behavior: Pick<ItemDefinition, "label" | "merge" | "producer" | "build"> = {},
): ItemDefinition {
  return { id, assetId, code, name, tier, maxStackSize, description, tags, sort, ...behavior };
}

function same(id: MergeDefinitionId, selfItemId: ItemId, resultItemId: ItemId): ItemMergeRule {
  return { id, withItemId: selfItemId, resultItemId };
}

function combo(id: MergeDefinitionId, withItemId: ItemId, resultItemId: ItemId, secret = false): ItemMergeRule {
  return { id, withItemId, resultItemId, secret };
}

function build(id: BuildRecipeId, resultItemId: ItemId, costs: readonly BuildRecipeCost[]): ItemBuildRecipe {
  return { id, resultItemId, costs };
}

function cost(itemId: ItemId, quantity: number): BuildRecipeCost {
  return { itemId, quantity };
}

function clickProducer(cooldownMs: number, drops: readonly ProducerDrop[], mode: ProducerMode = { type: "infinite" }): ProducerDefinition {
  return { trigger: "click", placement: "board_then_inventory", drops, cooldownMs, mode };
}

function autoProducer(tickMs: number, capacity: number, rechargeMs: number, drops: readonly ProducerDrop[]): ProducerDefinition {
  return {
    trigger: "auto",
    placement: "board_then_inventory",
    drops,
    mode: { type: "auto", tickMs, capacity, rechargeMs, enabledByDefault: true },
  };
}

function drops(entries: readonly ProducerDrop[]) {
  return entries;
}

function drop(itemId: ItemId, weight: number, quantity: Quantity = 1): ProducerDrop {
  return { itemId, weight, quantity };
}

function empty(weight: number): ProducerDrop {
  return { itemId: null, weight };
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
