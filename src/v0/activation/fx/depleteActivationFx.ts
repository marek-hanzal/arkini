import { Effect } from "effect";
import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { BoardRow } from "~/inventory/logic/planning/types";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { StashDefinition } from "~/manifest/producer";
import type { ActivationDepletionSchema } from "~/activation/type/ActivationDepletionSchema";
import { json } from "~/shared/json";

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
