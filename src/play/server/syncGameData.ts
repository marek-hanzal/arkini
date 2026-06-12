import { gameDataManifest, type GameDataManifest } from "~/manifest/server/gameDataManifest";
import { assertGameDataManifest } from "~/manifest/server/validation/manifest";
import { db } from "~/database/server/db";
import { table } from "~/database/server/tables";

export interface GameDataSyncResult {
  hash: string;
  changed: boolean;
}

// Runtime game definitions live in the TypeScript manifest. OPFS stores only
// the current manifest hash plus mutable save state. If the hash changes, the
// save is disposable. No archaeology, no compatibility shrine, no mercy.
export async function syncGameDataManifest(manifest: GameDataManifest = gameDataManifest): Promise<GameDataSyncResult> {
  assertGameDataManifest(manifest);

  const hash = await hashManifest(manifest);
  const timestamp = new Date().toISOString();

  return db.transaction().execute(async (tx) => {
    const previous = await tx
      .selectFrom(table.metadata)
      .select("value")
      .where("key", "=", "gameDataHash")
      .executeTakeFirst();

    await tx
      .insertInto(table.metadata)
      .values({ key: "gameDataHash", value: hash, updatedAt: timestamp })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: hash, updatedAt: timestamp }))
      .execute();

    return { hash, changed: previous?.value !== hash };
  });
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
