import { z } from "zod";
import { GameActionCraftStartSchema } from "~/v0/game/engine/model/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/v0/game/engine/model/GameActionItemMergeSchema";
import { GameActionProducerProductLineSetEnabledSchema } from "~/v0/game/engine/model/GameActionProducerProductLineSetEnabledSchema";
import { GameActionProducerProductStartSchema } from "~/v0/game/engine/model/GameActionProducerProductStartSchema";
import { GameActionStashOpenSchema } from "~/v0/game/engine/model/GameActionStashOpenSchema";
import { GameActionStoredRequirementStoreSchema } from "~/v0/game/engine/model/GameActionStoredRequirementStoreSchema";
import { GameActionStoredRequirementWithdrawSchema } from "~/v0/game/engine/model/GameActionStoredRequirementWithdrawSchema";
import { GameActionTileRemoveSchema } from "~/v0/game/engine/model/GameActionTileRemoveSchema";
import { GameActionUpgradeStartSchema } from "~/v0/game/engine/model/GameActionUpgradeStartSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionCraftStartSchema,
	GameActionItemMergeSchema,
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
