import { assertGameDataManifest, gameDataManifest, type GameDataManifest } from "~/domains/game-data";
import { db } from "./db";
import { table } from "./tables";

// Runtime game definitions live in the TypeScript manifest. OPFS stores
// mutable save state plus a manifest hash for debugging; prototype save
// compatibility is handled by the reset button, not by sneaky state surgery.
export async function syncGameDataManifest(manifest: GameDataManifest = gameDataManifest) {
  assertGameDataManifest(manifest);

  const manifestHash = await hashManifest(manifest);
  const timestamp = new Date().toISOString();

  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto(table.metadata)
      .values({ key: "gameDataHash", value: manifestHash, updatedAt: timestamp })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: manifestHash, updatedAt: timestamp }))
      .execute();
  });

  return manifestHash;
}

async function hashManifest(manifest: GameDataManifest) {
  const encoded = new TextEncoder().encode(
    JSON.stringify(manifest, (_key, value: unknown) => {
      if (typeof value === "string" && value.startsWith("blob:")) {
        return "[blob-url]";
      }

      return value;
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
