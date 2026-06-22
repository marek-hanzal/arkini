import { z } from "zod";
import { GameActionBoardItemMoveSchema } from "~/v0/game/action/GameActionBoardItemMoveSchema";
import { GameActionBoardItemStashSchema } from "~/v0/game/action/GameActionBoardItemStashSchema";
import { GameActionBoardItemsSwapSchema } from "~/v0/game/action/GameActionBoardItemsSwapSchema";
import { GameActionInventoryItemPlaceSchema } from "~/v0/game/action/GameActionInventoryItemPlaceSchema";
import { GameActionInventorySlotsSwapSchema } from "~/v0/game/action/GameActionInventorySlotsSwapSchema";
import { GameActionCraftInputStoreSchema } from "~/v0/game/action/GameActionCraftInputStoreSchema";
import { GameActionDebugItemSpawnSchema } from "~/v0/game/action/GameActionDebugItemSpawnSchema";
import { GameActionCraftInputWithdrawSchema } from "~/v0/game/action/GameActionCraftInputWithdrawSchema";
import { GameActionCraftStartSchema } from "~/v0/game/action/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/v0/game/action/GameActionItemMergeSchema";
import { GameActionProducerInputStoreSchema } from "~/v0/game/action/GameActionProducerInputStoreSchema";
import { GameActionProducerInputWithdrawSchema } from "~/v0/game/action/GameActionProducerInputWithdrawSchema";
import { GameActionProducerProductLineSetDefaultSchema } from "~/v0/game/action/GameActionProducerProductLineSetDefaultSchema";
import { GameActionProducerProductLineSetEnabledSchema } from "~/v0/game/action/GameActionProducerProductLineSetEnabledSchema";
import { GameActionProducerProductStartSchema } from "~/v0/game/action/GameActionProducerProductStartSchema";
import { GameActionStashOpenSchema } from "~/v0/game/action/GameActionStashOpenSchema";
import { GameActionStoredRequirementStoreSchema } from "~/v0/game/action/GameActionStoredRequirementStoreSchema";
import { GameActionStoredRequirementWithdrawSchema } from "~/v0/game/action/GameActionStoredRequirementWithdrawSchema";
import { GameActionTileRemoveSchema } from "~/v0/game/action/GameActionTileRemoveSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionBoardItemMoveSchema,
	GameActionBoardItemStashSchema,
	GameActionBoardItemsSwapSchema,
	GameActionCraftInputStoreSchema,
	GameActionCraftInputWithdrawSchema,
	GameActionCraftStartSchema,
	GameActionDebugItemSpawnSchema,
	GameActionItemMergeSchema,
	GameActionInventoryItemPlaceSchema,
	GameActionInventorySlotsSwapSchema,
	GameActionProducerInputStoreSchema,
	GameActionProducerInputWithdrawSchema,
	GameActionProducerProductLineSetDefaultSchema,
	GameActionProducerProductLineSetEnabledSchema,
	GameActionProducerProductStartSchema,
	GameActionStashOpenSchema,
	GameActionStoredRequirementStoreSchema,
	GameActionStoredRequirementWithdrawSchema,
	GameActionTileRemoveSchema,
]);

export type GameActionSchema = typeof GameActionSchema;

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
