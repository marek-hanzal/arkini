import {
  assertGameDataManifest,
  gameDataManifest,
  type GameDataManifest,
} from "@arkini/game-data";
import { kysely } from "./client";

const enabled = 1 as const;
const disabled = 0 as const;
const json = (value: unknown) => JSON.stringify(value);

// Static definitions are synchronized from one manifest on every bootstrap. The
// user save is not wiped; only the definition tables are forced back to the
// current game rules. This keeps balance changes boring, which is the highest
// compliment a data pipeline can receive.
export async function syncGameDataManifest(manifest: GameDataManifest = gameDataManifest) {
  assertGameDataManifest(manifest);

  const manifestHash = await hashManifest(manifest);

  await kysely.transaction().execute(async (tx) => {
    const now = new Date().toISOString();

    await tx.updateTable("assetDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const asset of manifest.assets) {
      await tx
        .insertInto("assetDefinition")
        .values({ ...asset, isEnabled: enabled })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            kind: asset.kind,
            label: asset.label,
            src: asset.src,
            sort: asset.sort,
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();
    }

    await tx.updateTable("itemDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const item of manifest.items) {
      await tx
        .insertInto("itemDefinition")
        .values({
          id: item.id,
          assetId: item.assetId,
          code: item.code,
          name: item.name,
          tier: item.tier,
          maxStackSize: item.maxStackSize,
          description: item.description,
          tagsJson: json(item.tags),
          sort: item.sort,
          isEnabled: enabled,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            assetId: item.assetId,
            code: item.code,
            name: item.name,
            tier: item.tier,
            maxStackSize: item.maxStackSize,
            description: item.description,
            tagsJson: json(item.tags),
            sort: item.sort,
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();
    }

    await tx.updateTable("mergeDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const merge of manifest.merges) {
      await tx
        .insertInto("mergeDefinition")
        .values({ ...merge, isEnabled: enabled })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            inputItemId: merge.inputItemId,
            inputCount: merge.inputCount,
            outputItemId: merge.outputItemId,
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();
    }

    await tx.deleteFrom("dropTableEntry").execute();
    await tx.updateTable("dropTableDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const dropTable of manifest.dropTables) {
      await tx
        .insertInto("dropTableDefinition")
        .values({ id: dropTable.id, label: dropTable.label, isEnabled: enabled })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            label: dropTable.label,
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();

      for (const [index, entry] of dropTable.entries.entries()) {
        await tx
          .insertInto("dropTableEntry")
          .values({
            id: `${dropTable.id}:${index}`,
            dropTableId: dropTable.id,
            itemDefinitionId: entry.itemId,
            weight: entry.weight,
            quantityJson: entry.itemId ? json(entry.quantity) : null,
            sort: index,
          })
          .execute();
      }
    }

    await tx.updateTable("producerDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const producer of manifest.producers) {
      await tx
        .insertInto("producerDefinition")
        .values({
          itemDefinitionId: producer.itemId,
          cooldownMs: producer.cooldownMs,
          modeJson: json(producer.mode),
          spawnJson: json(producer.spawn),
          rollsJson: json(producer.rolls),
          isEnabled: enabled,
        })
        .onConflict((oc) =>
          oc.column("itemDefinitionId").doUpdateSet({
            cooldownMs: producer.cooldownMs,
            modeJson: json(producer.mode),
            spawnJson: json(producer.spawn),
            rollsJson: json(producer.rolls),
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();
    }

    await tx.updateTable("buildRecipeDefinition").set({ isEnabled: disabled, updatedAt: now }).execute();
    for (const recipe of manifest.buildRecipes) {
      await tx
        .insertInto("buildRecipeDefinition")
        .values({
          id: recipe.id,
          blueprintItemId: recipe.blueprintItemId,
          resultItemId: recipe.resultItemId,
          costsJson: json(recipe.costs),
          isEnabled: enabled,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            blueprintItemId: recipe.blueprintItemId,
            resultItemId: recipe.resultItemId,
            costsJson: json(recipe.costs),
            isEnabled: enabled,
            updatedAt: now,
          }),
        )
        .execute();
    }

    await tx
      .insertInto("metadata")
      .values({ key: "gameDataHash", value: manifestHash })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: manifestHash, updatedAt: now }))
      .execute();

    await tx
      .insertInto("metadata")
      .values({ key: "gameDataVersion", value: String(manifest.game.dataVersion) })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ value: String(manifest.game.dataVersion), updatedAt: now }),
      )
      .execute();
  });

  return manifestHash;
}

async function hashManifest(manifest: GameDataManifest) {
  const encoded = new TextEncoder().encode(JSON.stringify(manifest, (_key, value: unknown) => {
    if (typeof value === "string" && value.startsWith("blob:")) {
      return "[blob-url]";
    }

    return value;
  }));
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
