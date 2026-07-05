import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

export type ProducerCompletionEvents = GameEngineCompletionResult["events"];

export const createMissingProducerJobResult = ({ save }: { save: GameSave }) =>
	({
		events: [],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;

export const createLineCompletedEvent = ({
	job,
	nowMs,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		itemInstanceId: job.itemInstanceId,
		lineId: job.lineId,
		type: "line.completed" as const,
	}) satisfies GameEvent;

export const createLineFailedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		itemInstanceId: job.itemInstanceId,
		lineId: job.lineId,
		reason,
		type: "line.failed" as const,
	}) satisfies GameEvent;

export const createLineBlockedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) =>
	({
		atMs: nowMs,
		jobId: job.id,
		itemInstanceId: job.itemInstanceId,
		lineId: job.lineId,
		reason,
		type: "line.blocked" as const,
	}) satisfies GameEvent;

export const createProducerChargesDepletedRemovalEvent = ({
	job,
	nowMs,
	producerId,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
	producerId: string;
}) =>
	({
		atMs: nowMs,
		itemId: producerId,
		itemInstanceId: job.itemInstanceId,
		reason: "producer-depleted" as const,
		type: "item.removed" as const,
	}) satisfies GameEvent;

export const createCompletedProducerJobResult = ({
	chargeEvents,
	job,
	nowMs,
	placementEvents = [],
	save,
}: {
	chargeEvents: ProducerCompletionEvents;
	job: GameSaveProducerJob;
	nowMs: number;
	placementEvents?: ProducerCompletionEvents;
	save: GameSave;
}) =>
	({
		events: [
			createLineCompletedEvent({
				job,
				nowMs,
			}),
			...chargeEvents,
			...placementEvents,
		],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;
