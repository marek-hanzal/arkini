import { Effect } from "effect";
import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { BoardRow } from "~/inventory/logic/planning/types";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { StashDefinition } from "~/manifest/producer";
import type { ProducerDepletion } from "~/play/logic/playTypes";
import { json } from "~/shared/json";

export namespace depleteFx {
	export interface Props {
		row: BoardRow;
		stash: StashDefinition;
	}
}

export const depleteFx = Effect.fn("depleteFx")(function* ({ row, stash }: depleteFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	return yield* match(stash.onDepleted)
		.with("remove", () =>
			dbFx(async (db) => {
				await db.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
				return {
					kind: "remove",
				} satisfies ProducerDepletion;
			}),
		)
		.with(
			{
				replaceWithItemId: P.string,
			},
			({ replaceWithItemId }) =>
				dbFx(async (db) => {
					await db
						.updateTable(table.boardItem)
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
					} satisfies ProducerDepletion;
				}),
		)
		.exhaustive();
});
