import { Effect } from "effect";
import { insertFx } from "~/board/fx/insertFx";
import { assertInsideBoard } from "~/board/logic/assertInsideBoard";
import { resumeCraftTimer } from "~/board/logic/resumeCraftTimer";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { spendStackFx } from "~/inventory/fx/spendStackFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { PlaceInventoryItemInputSchema } from "~/play/schema/PlaceInventoryItemInputSchema";
import type { ItemId } from "~/manifest/manifestId";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { InventoryPlaceResult } from "~/inventory/view/InventoryPlaceResultSchema";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";
import { parseJson } from "~/shared/parseJson";

export namespace placeFx {
	export interface Props {
		slotIndex: number;
		x: number;
		y: number;
	}
}

export const placeFx = Effect.fn("placeFx")(function* (props: placeFx.Props) {
	const input = yield* Effect.try({
		try: () => PlaceInventoryItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			assertInsideBoard(save, input.x, input.y);

			const stack = inventoryRows.find((row) => row.slotIndex === input.slotIndex);
			if (!stack) {
				return yield* Effect.fail(new GameActionError("Inventory slot is empty."));
			}
			if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
				return yield* Effect.fail(new GameActionError("Board cell is occupied."));
			}

			const resumedState = resumeCraftTimer(
				parseJson<BoardItemState>(stack.stateJson || "{}"),
				date,
			);

			const boardItemId = yield* insertFx({
				itemId: stack.itemDefinitionId as ItemId,
				x: input.x,
				y: input.y,
				stateJson: json(resumedState),
			});
			yield* spendStackFx({
				stack,
				quantity: 1,
			});

			return {
				boardItemId,
				itemId: stack.itemDefinitionId as ItemId,
				x: input.x,
				y: input.y,
			} satisfies InventoryPlaceResult;
		}),
	);
});
