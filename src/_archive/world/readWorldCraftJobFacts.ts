import { isCraftJobPaused, readCraftJobWakeAtMs } from "~/craft/craftCompletionTiming";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { WorldCraftJobFacts } from "~/world/WorldCraftJobFacts";

export namespace readWorldCraftJobFacts {
	export interface Props {
		nowMs?: number;
		save: GameSave;
	}
}

const readCraftJobStatus = ({
	job,
	nowMs,
	releaseAtMs,
}: {
	job: WorldCraftJobFacts["job"];
	nowMs?: number;
	releaseAtMs?: number;
}): WorldCraftJobFacts["status"] => {
	if (job.delivery) return "delivery_blocked";
	if (isCraftJobPaused(job)) return "paused";
	if (nowMs !== undefined && releaseAtMs !== undefined && releaseAtMs <= nowMs) return "ready";
	return "running";
};

export const readWorldCraftJobFacts = ({
	nowMs,
	save,
}: readWorldCraftJobFacts.Props): WorldCraftJobFacts[] =>
	Object.values(save.craftJobs)
		.map((job): WorldCraftJobFacts => {
			const releaseAtMs = readCraftJobWakeAtMs(job);
			return {
				job,
				releaseAtMs,
				status: readCraftJobStatus({
					job,
					nowMs,
					releaseAtMs,
				}),
			};
		})
		.sort(
			(left, right) =>
				(left.releaseAtMs ?? Number.POSITIVE_INFINITY) -
					(right.releaseAtMs ?? Number.POSITIVE_INFINITY) ||
				left.job.startAtMs - right.job.startAtMs ||
				left.job.id.localeCompare(right.job.id),
		);
