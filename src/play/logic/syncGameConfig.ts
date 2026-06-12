import { GameConfig } from "~/manifest/data/GameConfig";
import { assertGameConfig } from "~/manifest/data/validation/gameConfig";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";

export interface GameConfigSyncResult {
	hash: string;
	changed: boolean;
}

// Runtime game definitions live in the TypeScript config. OPFS stores only
// the current config hash plus mutable save state. If the hash changes, the
// save is disposable. No archaeology, no compatibility shrine, no mercy.
export async function syncGameConfig(
	config: GameConfig = GameConfig,
): Promise<GameConfigSyncResult> {
	assertGameConfig(config);

	const hash = await hashGameConfig(config);
	const timestamp = new Date().toISOString();

	return db.transaction().execute(async (tx) => {
		const previous = await tx
			.selectFrom(table.metadata)
			.select("value")
			.where("key", "=", "gameConfigHash")
			.executeTakeFirst();

		await tx
			.insertInto(table.metadata)
			.values({
				key: "gameConfigHash",
				value: hash,
				updatedAt: timestamp,
			})
			.onConflict((oc) =>
				oc.column("key").doUpdateSet({
					value: hash,
					updatedAt: timestamp,
				}),
			)
			.execute();

		return {
			hash,
			changed: previous?.value !== hash,
		};
	});
}

async function hashGameConfig(config: GameConfig) {
	const encoded = new TextEncoder().encode(
		JSON.stringify(config, (_key, value: unknown) => {
			if (typeof value === "string" && value.startsWith("blob:")) {
				return "[blob-url]";
			}

			return value;
		}),
	);
	const digest = await crypto.subtle.digest("SHA-256", encoded);

	return [
		...new Uint8Array(digest),
	]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
