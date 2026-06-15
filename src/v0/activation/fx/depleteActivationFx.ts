import { Effect } from "effect";
import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import type { BoardRow } from "~/v0/inventory/logic/planning/types";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { StashDefinition } from "~/v0/manifest/producer";
import type { ActivationDepletionSchema } from "~/v0/activation/type/ActivationDepletionSchema";
import { json } from "~/v0/serialization/json";

export namespace depleteActivationFx {
	export interface Props {
		row: BoardRow;
		stash: StashDefinition;
	}
}

export const depleteActivationFx = Effect.fn("depleteActivationFx")(function* ({
	row,
	stash,
}: depleteActivationFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	return yield* match(stash.onDepleted)
		.with("remove", () =>
			dbFx(async (db) => {
				await db
					.deleteFrom("itemInstance")
					.where("locationKind", "=", "activation-input")
					.where("ownerItemInstanceId", "=", row.id)
					.execute();
				await db.deleteFrom("itemInstance").where("id", "=", row.id).execute();
				return {
					kind: "remove",
				} satisfies ActivationDepletionSchema.Type;
			}),
		)
		.with(
			{
				replaceWithItemId: P.string,
			},
			({ replaceWithItemId }) =>
				dbFx(async (db) => {
					await db
						.deleteFrom("itemInstance")
						.where("locationKind", "=", "activation-input")
						.where("ownerItemInstanceId", "=", row.id)
						.execute();
					await db
						.updateTable("itemInstance")
						.set({
							itemDefinitionId: replaceWithItemId,
							stateJson: json(createInitialBoardState(replaceWithItemId, gameConfig)),
							updatedAt: timestamp,
						})
						.where("id", "=", row.id)
						.execute();
					return {
						kind: "replace",
						itemId: replaceWithItemId,
					} satisfies ActivationDepletionSchema.Type;
				}),
		)
		.exhaustive();
});
