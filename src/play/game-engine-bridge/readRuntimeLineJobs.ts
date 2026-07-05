import type { RuntimeProducerQueueViewState } from "~/play/game-engine-bridge/readRuntimeProducerQueueViewState";

export namespace readRuntimeLineJobs {
	export interface Props {
		lineId: string;
		queueState: RuntimeProducerQueueViewState;
	}
}

export const readRuntimeLineJobs = ({ lineId, queueState }: readRuntimeLineJobs.Props) =>
	queueState.jobs
		.filter((job) => job.lineId === lineId)
		.sort((left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id));
