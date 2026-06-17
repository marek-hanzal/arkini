import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { createGameItemInstanceIdFx } from "~/v0/game/engine/fx/createGameItemInstanceIdFx";
import { findFirstEmptyBoardCellFx } from "~/v0/game/engine/fx/findFirstEmptyBoardCellFx";
import { placeGameSaveInventoryRemainderFx } from "~/v0/game/engine/fx/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		item: GameSaveItemPlacementRequest;
		save: GameSave;
	}
}

export const placeSingleGameSaveItemRequestFx = Effect.fn("placeSingleGameSaveItemRequestFx")(
	function* ({ config, events, item, save }: placeSingleGameSaveItemRequestFx.Props) {
		const itemDefinition = config.items[item.itemId];

		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
			);
		}

		let remainingQuantity = item.quantity;

		while (remainingQuantity > 0) {
			const emptyCell = yield* findFirstEmptyBoardCellFx({
				config,
				save,
			});

			if (!emptyCell) {
				break;
			}

			const itemInstanceId = yield* createGameItemInstanceIdFx({
				save,
			});
			save.board.items[itemInstanceId] = {
				id: itemInstanceId,
				itemId: item.itemId,
				x: emptyCell.x,
				y: emptyCell.y,
			};
			events.push({
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				reason: item.reason,
				to: {
					kind: "board",
					itemInstanceId,
					x: emptyCell.x,
					y: emptyCell.y,
				},
				type: "item.created",
			});
			remainingQuantity -= 1;
		}

		return yield* placeGameSaveInventoryRemainderFx({
			events,
			item,
			maxStackSize: itemDefinition.maxStackSize,
			remainingQuantity,
			slots: save.inventory.slots,
		});
	},
);
