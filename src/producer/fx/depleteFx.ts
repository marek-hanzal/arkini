import { Effect } from "effect";
import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import type { BoardRow } from "~/inventory/logic/planning";
import type { ProducerMode } from "~/manifest/data/producer";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { ProducerDepletion } from "~/play/logic/playTypes";
import { json } from "~/shared/json";

export namespace depleteFx {
	export interface Props {
		row: BoardRow;
		mode: ProducerMode;
	}
}

export const depleteFx = Effect.fn("depleteFx")(function* ({ row, mode }: depleteFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	return yield* match(mode)
		.with(
			{
				type: "finite",
				onDepleted: "remove",
			},
			() =>
				dbFx(async (db) => {
					await db.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
					return {
						kind: "remove",
					} satisfies ProducerDepletion;
				}),
		)
		.with(
			{
				type: "finite",
				onDepleted: {
					replaceWithItemId: P.string,
				},
			},
			({ onDepleted }) =>
				dbFx(async (db) => {
					await db
						.updateTable(table.boardItem)
						.set({
							itemDefinitionId: onDepleted.replaceWithItemId,
							stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)),
							updatedAt: timestamp,
						})
						.where("id", "=", row.id)
						.execute();
					return {
						kind: "replace",
						itemId: onDepleted.replaceWithItemId,
					} satisfies ProducerDepletion;
				}),
		)
		.otherwise(() => Effect.succeed(undefined));
});
