import { z } from "zod";
import { GameActionBoardItemMoveSchema } from "~/action/GameActionBoardItemMoveSchema";
import { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import { GameActionBoardMemoryClearSchema } from "~/action/GameActionBoardMemoryClearSchema";
import { GameActionBoardItemsSwapSchema } from "~/action/GameActionBoardItemsSwapSchema";
import { GameActionCheatSpeedModeSetSchema } from "~/action/GameActionCheatSpeedModeSetSchema";
import { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import { GameActionInventorySlotsSwapSchema } from "~/action/GameActionInventorySlotsSwapSchema";
import { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import { GameActionDebugBoardItemDeleteSchema } from "~/action/GameActionDebugBoardItemDeleteSchema";
import { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { GameActionCraftInputWithdrawSchema } from "~/action/GameActionCraftInputWithdrawSchema";
import { GameActionCraftStartSchema } from "~/action/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { GameActionItemStackSchema } from "~/action/GameActionItemStackSchema";
import { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import { GameActionProducerInputWithdrawSchema } from "~/action/GameActionProducerInputWithdrawSchema";
import { GameActionLineSetDefaultSchema } from "~/action/GameActionLineSetDefaultSchema";
import { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import { GameActionStashOpenSchema } from "~/action/GameActionStashOpenSchema";
import { GameActionTileRemoveSchema } from "~/action/GameActionTileRemoveSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionBoardItemMoveSchema,
	GameActionBoardItemStashSchema,
	GameActionBoardMemoryActivateSchema,
	GameActionBoardMemoryClearSchema,
	GameActionBoardItemsSwapSchema,
	GameActionCheatSpeedModeSetSchema,
	GameActionCraftInputStoreSchema,
	GameActionCraftInputWithdrawSchema,
	GameActionCraftStartSchema,
	GameActionDebugBoardItemDeleteSchema,
	GameActionDebugItemSpawnSchema,
	GameActionItemMergeSchema,
	GameActionItemStackSchema,
	GameActionInventoryItemPlaceSchema,
	GameActionInventorySlotsSwapSchema,
	GameActionProducerInputStoreSchema,
	GameActionProducerInputWithdrawSchema,
	GameActionLineSetDefaultSchema,
	GameActionLineStartSchema,
	GameActionStashOpenSchema,
	GameActionTileRemoveSchema,
]);

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
