import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { GameConfig } from "~/manifest/data/GameConfig";
import { assertGameConfig } from "~/manifest/data/validation/gameConfig";
import type { GameConfigSyncResult } from "~/play/logic/GameConfigSyncResult";
import { hashConfigFx } from "./hashConfigFx";

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
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const previous = yield* dbFx((db) =>
				db
					.selectFrom(table.metadata)
					.select("value")
					.where("key", "=", "gameConfigHash")
					.executeTakeFirst(),
			);

			yield* dbFx((db) =>
				db
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
					.execute(),
			);

			return {
				hash,
				changed: previous?.value !== hash,
			} satisfies GameConfigSyncResult;
		}),
	);
});
