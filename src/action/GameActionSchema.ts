import { z } from "zod";
import { GameActionBoardItemMoveSchema } from "~/action/GameActionBoardItemMoveSchema";
import { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { GameActionBoardItemsSwapSchema } from "~/action/GameActionBoardItemsSwapSchema";
import { GameActionCheatSpeedModeSetSchema } from "~/action/GameActionCheatSpeedModeSetSchema";
import { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import { GameActionInventorySlotsSwapSchema } from "~/action/GameActionInventorySlotsSwapSchema";
import { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { GameActionCraftInputWithdrawSchema } from "~/action/GameActionCraftInputWithdrawSchema";
import { GameActionCraftStartSchema } from "~/action/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import { GameActionProducerInputWithdrawSchema } from "~/action/GameActionProducerInputWithdrawSchema";
import { GameActionLineSetDefaultSchema } from "~/action/GameActionLineSetDefaultSchema";
import { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import { GameActionStashOpenSchema } from "~/action/GameActionStashOpenSchema";
import { GameActionTileRemoveSchema } from "~/action/GameActionTileRemoveSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionBoardItemMoveSchema,
	GameActionBoardItemStashSchema,
	GameActionBoardItemsSwapSchema,
	GameActionCheatSpeedModeSetSchema,
	GameActionCraftInputStoreSchema,
	GameActionCraftInputWithdrawSchema,
	GameActionCraftStartSchema,
	GameActionDebugItemSpawnSchema,
	GameActionItemMergeSchema,
	GameActionInventoryItemPlaceSchema,
	GameActionInventorySlotsSwapSchema,
	GameActionProducerInputStoreSchema,
	GameActionProducerInputWithdrawSchema,
	GameActionLineSetDefaultSchema,
	GameActionLineStartSchema,
	GameActionStashOpenSchema,
	GameActionTileRemoveSchema,
]);

export type GameActionSchema = typeof GameActionSchema;

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
