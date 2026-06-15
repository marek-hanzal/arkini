import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { GameConfig } from "~/manifest/GameConfig";
import { assertGameConfig } from "~/manifest/validation/gameConfig";
import type { GameConfigSyncResult } from "~/play/logic/GameConfigSyncResult";
import { hashConfigFx } from "./hashConfigFx";

export namespace syncConfigFx {
	export interface Props {
		config?: GameConfig;
	}
}

export const syncConfigFx = Effect.fn("syncConfigFx")(function* ({
	config,
}: syncConfigFx.Props = {}) {
	const gameConfig = yield* GameConfigServiceFx;
	const effectiveConfig = config ?? gameConfig.config;
	assertGameConfig(effectiveConfig);

	const hash = yield* hashConfigFx({
		config: effectiveConfig,
	});
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const previous = yield* dbFx((db) =>
				db
					.selectFrom("metadata")
					.select("value")
					.where("key", "=", "gameConfigHash")
					.executeTakeFirst(),
			);

			yield* dbFx((db) =>
				db
					.insertInto("metadata")
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
