import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

export namespace readLineIdsVisibleOrCurrentlyQueued {
	export interface Props {
		lineIds: readonly string[];
		producerJobs: readonly GameSaveProducerJob[];
		visibleLineIds: readonly string[];
	}
}

export const readLineIdsVisibleOrCurrentlyQueued = ({
	producerJobs,
	lineIds,
	visibleLineIds,
}: readLineIdsVisibleOrCurrentlyQueued.Props) => {
	const visible = new Set(visibleLineIds);
	const jobLineIds = new Set(producerJobs.map((job) => job.lineId));

	return lineIds.filter((lineId) => visible.has(lineId) || jobLineIds.has(lineId));
};
