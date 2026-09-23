import { z } from "zod";

/** The finite vocabulary of committed gameplay events published by one Game. */
export const GameEventEnumSchema = z
	.enum({
		BoardTemplateApplied: "board:template-applied",
		CurrentSpaceChanged: "current-space:changed",
		JobQueued: "job:queued",
		LineInputAutofillStarted: "line-input:autofill-started",
		JobQueueCleared: "job-queue:cleared",
		JobStarted: "job:started",
		JobCompleted: "job:completed",
		JobAborted: "job:aborted",
		ItemDiscarded: "item:discarded",
		ItemMerged: "item:merged",
		ItemExpired: "item:expired",
		ItemSpawned: "item:spawned",
		ItemPlaced: "item:placed",
		ItemSwapped: "item:swapped",
		ItemConsumed: "item:consumed",
		ItemInputStored: "item:input-stored",
		ItemUnitSpent: "item:unit-spent",
		ItemDepleted: "item:depleted",
		ItemDisappeared: "item:disappeared",
		ItemRemoved: "item:removed",
	})
	.meta({
		id: "GameEventEnumSchema",
		description: "The finite vocabulary of committed gameplay events published by one Game.",
	});

export type GameEventEnumSchema = typeof GameEventEnumSchema;

export namespace GameEventEnumSchema {
	export type Type = z.infer<GameEventEnumSchema>;
}
