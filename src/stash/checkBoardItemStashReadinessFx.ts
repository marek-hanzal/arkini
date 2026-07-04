import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
import type { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkBoardItemStashReadinessFx {
	export interface Props {
		action: GameActionBoardItemStashSchema.Type;
		config: GameConfig;
		save: GameSave;
	}
}

export const checkBoardItemStashReadinessFx = Effect.fn("checkBoardItemStashReadinessFx")(
	function* ({ action, config, save }: checkBoardItemStashReadinessFx.Props) {
		const item = save.board.items[action.boardItemId];
		if (!item) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("invalid_actor", "Board item does not exist."),
			);
		}

		const itemDefinition = yield* readGameConfigItemDefinitionFx({
			config,
			itemId: item.itemId,
		});

		if (
			!isItemStorageAllowed({
				config,
				itemId: item.itemId,
				location: "inventory",
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"storage_restricted",
					`Item "${item.itemId}" cannot be stored in inventory.`,
				),
			);
		}

		const stateStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: item.id,
			save,
		});
		if (stateStatus.busy) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					"Board item has a running job and cannot be moved to inventory.",
				),
			);
		}

		const shouldPreserveInstance = stateStatus.preservable || item.itemId === boardMemoryItemId;
		const hasInventoryTarget = shouldPreserveInstance
			? save.inventory.slots.some((slot) => !slot)
			: (yield* readInventoryStackCapacityFx({
					itemId: item.itemId,
					maxStackSize: itemDefinition.maxStackSize,
					slots: save.inventory.slots,
				})) >= 1;

		if (!hasInventoryTarget) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("inventory:full", "Inventory is full."),
			);
		}

		return {
			item,
			stateStatus,
		};
	},
);
