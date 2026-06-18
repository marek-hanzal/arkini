import { z } from "zod";
import { GameActionBoardItemMoveSchema } from "~/v0/game/engine/model/GameActionBoardItemMoveSchema";
import { GameActionBoardItemStashSchema } from "~/v0/game/engine/model/GameActionBoardItemStashSchema";
import { GameActionBoardItemsSwapSchema } from "~/v0/game/engine/model/GameActionBoardItemsSwapSchema";
import { GameActionInventoryItemPlaceSchema } from "~/v0/game/engine/model/GameActionInventoryItemPlaceSchema";
import { GameActionInventorySlotsSwapSchema } from "~/v0/game/engine/model/GameActionInventorySlotsSwapSchema";
import { GameActionCraftStartSchema } from "~/v0/game/engine/model/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/v0/game/engine/model/GameActionItemMergeSchema";
import { GameActionProducerInputStoreSchema } from "~/v0/game/engine/model/GameActionProducerInputStoreSchema";
import { GameActionProducerInputWithdrawSchema } from "~/v0/game/engine/model/GameActionProducerInputWithdrawSchema";
import { GameActionProducerProductLineSetEnabledSchema } from "~/v0/game/engine/model/GameActionProducerProductLineSetEnabledSchema";
import { GameActionProducerProductStartSchema } from "~/v0/game/engine/model/GameActionProducerProductStartSchema";
import { GameActionStashOpenSchema } from "~/v0/game/engine/model/GameActionStashOpenSchema";
import { GameActionStoredRequirementStoreSchema } from "~/v0/game/engine/model/GameActionStoredRequirementStoreSchema";
import { GameActionStoredRequirementWithdrawSchema } from "~/v0/game/engine/model/GameActionStoredRequirementWithdrawSchema";
import { GameActionTileRemoveSchema } from "~/v0/game/engine/model/GameActionTileRemoveSchema";
import { GameActionUpgradeStartSchema } from "~/v0/game/engine/model/GameActionUpgradeStartSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionBoardItemMoveSchema,
	GameActionBoardItemStashSchema,
	GameActionBoardItemsSwapSchema,
	GameActionCraftStartSchema,
	GameActionItemMergeSchema,
	GameActionInventoryItemPlaceSchema,
	GameActionInventorySlotsSwapSchema,
	GameActionProducerInputStoreSchema,
	GameActionProducerInputWithdrawSchema,
	GameActionProducerProductLineSetEnabledSchema,
	GameActionProducerProductStartSchema,
	GameActionStashOpenSchema,
	GameActionStoredRequirementStoreSchema,
	GameActionStoredRequirementWithdrawSchema,
	GameActionTileRemoveSchema,
	GameActionUpgradeStartSchema,
]);

export type GameActionSchema = typeof GameActionSchema;

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
