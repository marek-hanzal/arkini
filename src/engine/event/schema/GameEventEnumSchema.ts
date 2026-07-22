import { z } from "zod";

/** The finite vocabulary of committed gameplay events published by one Game. */
export const GameEventEnumSchema = z
	.enum({
		CurrentSpaceChanged: "current-space:changed",
		JobStarted: "job:started",
		JobCompleted: "job:completed",
		ItemMerged: "item:merged",
		ItemExpired: "item:expired",
		ItemSpawned: "item:spawned",
		ItemPlaced: "item:placed",
		ItemStacked: "item:stacked",
		ItemSplit: "item:split",
		ItemConsumed: "item:consumed",
		ItemInputStored: "item:input-stored",
		ItemDepleted: "item:depleted",
	})
	.meta({
		id: "GameEventEnumSchema",
		description: "The finite vocabulary of committed gameplay events published by one Game.",
	});

export type GameEventEnumSchema = typeof GameEventEnumSchema;

export namespace GameEventEnumSchema {
	export type Type = z.infer<GameEventEnumSchema>;
}
