import { match } from "ts-pattern";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";

export type RuntimeProducerQueueViewState = {
	activeJob?: GameSaveProducerJob;
	activeJobFacts?: WorldProducerJobFacts;
	jobs: readonly GameSaveProducerJob[];
	producerJobFacts: readonly WorldProducerJobFacts[];
	queueBlockedReason?: "delivery_blocked" | "paused";
	queueFull: boolean;
	queueUsed: number;
};

export namespace readRuntimeProducerQueueViewState {
	export interface Props {
		maxQueueSize: number;
		nowMs: number;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readProducerQueueBlockedReason = (
	producerJobFacts: readonly WorldProducerJobFacts[],
): RuntimeProducerQueueViewState["queueBlockedReason"] => {
	const blockingStatus =
		producerJobFacts.find((facts) => facts.status === "delivery_blocked")?.status ??
		producerJobFacts.find((facts) => facts.status === "paused")?.status;

	return match(blockingStatus)
		.with("delivery_blocked", () => "delivery_blocked" as const)
		.with("paused", () => "paused" as const)
		.otherwise(() => undefined);
};

export const readRuntimeProducerQueueViewState = ({
	maxQueueSize,
	nowMs,
	save,
	targetItemInstanceId,
}: readRuntimeProducerQueueViewState.Props): RuntimeProducerQueueViewState => {
	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.itemInstanceId === targetItemInstanceId);
	const jobs = producerJobFacts.map((facts) => facts.job);
	const queueUsed = jobs.length;
	const activeJobFacts = producerJobFacts.find((facts) => facts.queueIndex === 0);

	return {
		activeJob: activeJobFacts?.job,
		activeJobFacts,
		jobs,
		producerJobFacts,
		queueBlockedReason: readProducerQueueBlockedReason(producerJobFacts),
		queueFull: queueUsed >= maxQueueSize,
		queueUsed,
	};
};
