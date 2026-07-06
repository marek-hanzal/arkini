import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";

export const createCraftCompletedEvent = ({
	job,
	nowMs,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		recipeId: job.recipeId,
		targetItemInstanceId: job.targetItemInstanceId,
		type: "craft.completed" as const,
	}) satisfies GameEvent;

const createCraftResultReplacedEvent = ({
	fromItemId,
	job,
	nowMs,
	recipe,
}: {
	fromItemId: string;
	job: GameSaveCraftJob;
	nowMs: number;
	recipe: GameCraftRecipeDefinition;
}) =>
	({
		atMs: nowMs,
		fromItemId,
		itemInstanceId: job.targetItemInstanceId,
		reason: "craft-result" as const,
		toItemId: recipe.resultItemId,
		type: "item.replaced" as const,
	}) satisfies GameEvent;

export const createCraftFailedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		reason,
		recipeId: job.recipeId,
		targetItemInstanceId: job.targetItemInstanceId,
		type: "craft.failed" as const,
	}) satisfies GameEvent;

export const createCraftBlockedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		reason,
		recipeId: job.recipeId,
		targetItemInstanceId: job.targetItemInstanceId,
		type: "craft.blocked" as const,
	}) satisfies GameEvent;

export const createCraftCompletedResult = ({
	fromItemId,
	job,
	nowMs,
	recipe,
	save,
}: {
	fromItemId: string;
	job: GameSaveCraftJob;
	nowMs: number;
	recipe: GameCraftRecipeDefinition;
	save: GameSave;
}) =>
	({
		events: [
			createCraftCompletedEvent({
				job,
				nowMs,
			}),
			createCraftResultReplacedEvent({
				fromItemId,
				job,
				nowMs,
				recipe,
			}),
		],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;

export const createCraftSpawnCompletedResult = ({
	events,
	job,
	nowMs,
	save,
}: {
	events: GameEvent[];
	job: GameSaveCraftJob;
	nowMs: number;
	save: GameSave;
}) =>
	({
		events: [
			createCraftCompletedEvent({
				job,
				nowMs,
			}),
			...events,
		],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;

export const createMissingCraftJobResult = ({ save }: { save: GameSave }) =>
	({
		events: [],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;
