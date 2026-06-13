import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { GameConfig } from "~/manifest/data/GameConfig";
import { assertGameConfig } from "~/manifest/data/validation/gameConfig";
import { hashConfigFx } from "./hashConfigFx";
import { tryGameActionFx } from "./tryGameActionFx";

export interface GameConfigSyncResult {
	hash: string;
	changed: boolean;
}

export namespace syncConfigFx {
	export interface Props {
		config?: GameConfig;
	}
}

export const syncConfigFx = Effect.fn("syncConfigFx")(function* ({
	config = GameConfig,
}: syncConfigFx.Props = {}) {
	assertGameConfig(config);

	const hash = yield* hashConfigFx({
		config,
	});
	const timestamp = new Date().toISOString();

	return yield* tryGameActionFx(() =>
		db.transaction().execute(async (tx) => {
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
			} satisfies GameConfigSyncResult;
		}),
	);
});
