import { Effect } from "effect";
import { insertFx } from "~/board/fx/insertFx";
import { assertInsideBoard } from "~/board/logic/gameBounds";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { spendStackFx } from "~/inventory/fx/spendStackFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { PlaceInventoryItemInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

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

	yield* withTransactionFx(
		Effect.gen(function* () {
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			assertInsideBoard(save, input.x, input.y);

			const stack = inventoryRows.find((row) => row.slotIndex === input.slotIndex);
			if (!stack) {
				return yield* Effect.fail(new GameActionError("Inventory slot is empty."));
			}
			if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
				return yield* Effect.fail(new GameActionError("Board cell is occupied."));
			}

			yield* insertFx({
				itemId: stack.itemDefinitionId,
				x: input.x,
				y: input.y,
			});
			yield* spendStackFx({
				stack,
				quantity: 1,
			});
		}),
	);
});
