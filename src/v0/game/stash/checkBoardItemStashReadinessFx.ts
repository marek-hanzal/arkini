import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import type { GameActionBoardItemStashSchema } from "~/v0/game/engine/model/GameActionBoardItemStashSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { isGameSaveInventoryStack } from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkBoardItemStashReadinessFx {
	export interface Props {
		action: GameActionBoardItemStashSchema.Type;
		config: GameConfig;
		save: GameSave;
	}
}

const readInventoryStackCapacity = ({
	itemId,
	maxStackSize,
	save,
}: {
	itemId: string;
	maxStackSize: number;
	save: GameSave;
}) =>
	save.inventory.slots.reduce((capacity, slot) => {
		if (!slot) {
			return capacity + maxStackSize;
		}

		if (isGameSaveInventoryStack(slot) && slot.itemId === itemId) {
			return capacity + Math.max(0, maxStackSize - slot.quantity);
		}

		return capacity;
	}, 0);

export const checkBoardItemStashReadinessFx = Effect.fn("checkBoardItemStashReadinessFx")(
	function* ({ action, config, save }: checkBoardItemStashReadinessFx.Props) {
		const item = save.board.items[action.boardItemId];
		if (!item) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("invalid_actor", "Board item does not exist."),
			);
		}

		const itemDefinition = config.items[item.itemId];
		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
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

		const hasInventoryTarget = stateStatus.preservable
			? save.inventory.slots.some((slot) => !slot)
			: readInventoryStackCapacity({
					itemId: item.itemId,
					maxStackSize: itemDefinition.maxStackSize,
					save,
				}) >= 1;

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
