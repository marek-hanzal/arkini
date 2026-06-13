import { Effect } from "effect";
import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/logic/boardState";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import type { BoardRow } from "~/inventory/logic/planning";
import type { ProducerMode } from "~/manifest/data/producer";
import { localTimestamp } from "~/play/logic/localTimestamp";
import type { ProducerDepletion } from "~/play/logic/playTypes";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { json } from "~/shared/json";

export namespace depleteFx {
	export interface Props {
		tx: ArkiniTransaction;
		row: BoardRow;
		mode: ProducerMode;
	}
}

export const depleteFx = Effect.fn("depleteFx")(function* ({ tx, row, mode }: depleteFx.Props) {
	return yield* match(mode)
		.with(
			{
				type: "finite",
				onDepleted: "remove",
			},
			() =>
				tryGameActionFx(async () => {
					await tx.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
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
				tryGameActionFx(async () => {
					await tx
						.updateTable(table.boardItem)
						.set({
							itemDefinitionId: onDepleted.replaceWithItemId,
							stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)),
							updatedAt: localTimestamp(),
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
