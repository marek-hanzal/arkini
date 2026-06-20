import { Effect } from "effect";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameActionDebugItemSpawn } from "~/v0/game/action/GameActionDebugItemSpawn";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkDebugItemSpawnReadinessFx {
	export interface Props {
		action: GameActionDebugItemSpawn;
		config: GameConfig;
		save: GameSave;
	}
}

const hasInventoryCapacity = ({
	config,
	itemId,
	quantity,
	save,
}: {
	config: GameConfig;
	itemId: string;
	quantity: number;
	save: GameSave;
}) => {
	const item = config.items[itemId];
	if (!item) return false;

	let available = 0;
	for (const slot of save.inventory.slots) {
		if (!slot) {
			available += item.maxStackSize;
			continue;
		}

		if ("kind" in slot) continue;
		if (slot.itemId !== itemId) continue;

		available += Math.max(0, item.maxStackSize - slot.quantity);
	}

	return available >= quantity;
};

export const checkDebugItemSpawnReadinessFx = Effect.fn("checkDebugItemSpawnReadinessFx")(
	function* ({ action, config, save }: checkDebugItemSpawnReadinessFx.Props) {
		const item = config.items[action.itemId];
		if (!item) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
			);
		}

		if (
			!isItemStorageAllowed({
				config,
				itemId: action.itemId,
				location: action.location,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"storage_restricted",
					`Item "${action.itemId}" cannot be spawned into ${action.location}.`,
				),
			);
		}

		const quantity = action.quantity ?? 1;

		if (action.location === "board") {
			const freeBoardCells =
				config.game.board.width * config.game.board.height -
				Object.keys(save.board.items).length;
			if (freeBoardCells < quantity) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:full",
						"Board has no space for debug item.",
					),
				);
			}
			return;
		}

		if (
			!hasInventoryCapacity({
				config,
				itemId: action.itemId,
				quantity,
				save,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"inventory:full",
					"Inventory has no space for debug item.",
				),
			);
		}
	},
);
