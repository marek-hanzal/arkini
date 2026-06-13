import { Effect } from "effect";
import { assertInsideBoard } from "~/board/logic/gameBounds";
import { insertFx } from "~/board/logic/fx/insertFx";
import { db } from "~/database/local/db";
import { spendStackFx } from "~/inventory/logic/fx/spendStackFx";
import { PlaceInventoryItemInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/logic/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/fx/toGameActionError";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { GameActionError } from "~/play/logic/playTypes";

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

	yield* tryGameActionFx(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { save, boardRows, inventoryRows } = yield* readMutableSaveFx({
						tx,
					});
					assertInsideBoard(save, input.x, input.y);

					const stack = inventoryRows.find((row) => row.slotIndex === input.slotIndex);
					if (!stack)
						return yield* Effect.fail(new GameActionError("Inventory slot is empty."));
					if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
						return yield* Effect.fail(new GameActionError("Board cell is occupied."));
					}

					yield* insertFx({
						tx,
						itemId: stack.itemDefinitionId,
						x: input.x,
						y: input.y,
					});
					yield* spendStackFx({
						tx,
						stack,
						quantity: 1,
					});
				}),
			),
		),
	);
});
