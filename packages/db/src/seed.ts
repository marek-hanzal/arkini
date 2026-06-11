import { assetDefinitions } from "@arkini/assets";
import { boardConfig } from "@arkini/game";
import { kysely } from "./client";

const itemDefinitions = [
  { id: "item:seed", assetId: "asset:item-seed", code: "seed", name: "Seed", tier: 1, description: "Tiny start of something suspiciously grindy.", sort: 10 },
  { id: "item:sprout", assetId: "asset:item-sprout", code: "sprout", name: "Sprout", tier: 2, description: "A plant pretending it has a future.", sort: 20 },
  { id: "item:leaf", assetId: "asset:item-leaf", code: "leaf", name: "Leaf", tier: 3, description: "Photosynthesis, but make it collectible.", sort: 30 },
  { id: "item:twig", assetId: "asset:item-twig", code: "twig", name: "Twig", tier: 1, description: "Nature's disposable stick.", sort: 40 },
  { id: "item:branch", assetId: "asset:item-branch", code: "branch", name: "Branch", tier: 2, description: "Bigger stick. Humanity is saved.", sort: 50 },
  { id: "item:log", assetId: "asset:item-log", code: "log", name: "Log", tier: 3, description: "A tree with fewer opinions.", sort: 60 },
  { id: "item:pebble", assetId: "asset:item-pebble", code: "pebble", name: "Pebble", tier: 1, description: "Small rock. Big destiny. Apparently.", sort: 70 },
  { id: "item:stone", assetId: "asset:item-stone", code: "stone", name: "Stone", tier: 2, description: "Rock with self-esteem.", sort: 80 },
  { id: "item:crystal", assetId: "asset:item-crystal", code: "crystal", name: "Crystal", tier: 3, description: "Shiny enough to justify bad decisions.", sort: 90 },
] as const;

const mergeRecipes = [
  { id: "recipe:seed-to-sprout", inputItemId: "item:seed", outputItemId: "item:sprout", inputCount: 2 },
  { id: "recipe:sprout-to-leaf", inputItemId: "item:sprout", outputItemId: "item:leaf", inputCount: 2 },
  { id: "recipe:twig-to-branch", inputItemId: "item:twig", outputItemId: "item:branch", inputCount: 2 },
  { id: "recipe:branch-to-log", inputItemId: "item:branch", outputItemId: "item:log", inputCount: 2 },
  { id: "recipe:pebble-to-stone", inputItemId: "item:pebble", outputItemId: "item:stone", inputCount: 2 },
  { id: "recipe:stone-to-crystal", inputItemId: "item:stone", outputItemId: "item:crystal", inputCount: 2 },
] as const;

export async function seedDatabase() {
  await kysely.transaction().execute(async (tx) => {
    for (const asset of assetDefinitions) {
      await tx
        .insertInto("assetDefinition")
        .values(asset)
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            kind: asset.kind,
            label: asset.label,
            src: asset.src,
          }),
        )
        .execute();
    }

    for (const item of itemDefinitions) {
      await tx
        .insertInto("itemDefinition")
        .values(item)
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            assetId: item.assetId,
            code: item.code,
            name: item.name,
            tier: item.tier,
            description: item.description,
            sort: item.sort,
          }),
        )
        .execute();
    }

    for (const recipe of mergeRecipes) {
      await tx
        .insertInto("mergeRecipe")
        .values(recipe)
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            inputItemId: recipe.inputItemId,
            outputItemId: recipe.outputItemId,
            inputCount: recipe.inputCount,
          }),
        )
        .execute();
    }

    await tx
      .insertInto("saveGame")
      .values({
        id: "save:default",
        name: "Default board",
        boardWidth: boardConfig.width,
        boardHeight: boardConfig.height,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          name: "Default board",
          boardWidth: boardConfig.width,
          boardHeight: boardConfig.height,
        }),
      )
      .execute();
  });
}
