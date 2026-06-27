import { readCraftJobWakeAtMs } from "~/v0/game/craft/craftCompletionTiming";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { WorldCraftJobFacts } from "~/v0/game/world/WorldCraftJobFacts";

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
	releaseAtMs: number;
}): WorldCraftJobFacts["status"] => {
	if (job.delivery) return "delivery_blocked";
	if (nowMs !== undefined && releaseAtMs <= nowMs) return "ready";
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
				left.releaseAtMs - right.releaseAtMs ||
				left.job.startAtMs - right.job.startAtMs ||
				left.job.id.localeCompare(right.job.id),
		);
