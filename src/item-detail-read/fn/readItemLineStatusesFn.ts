import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";

export namespace readItemLineStatusesFn {
	export interface Status {
		readonly lineUid: IdSchema.Type;
		readonly state:
			| "idle"
			| "waiting-inputs"
			| "waiting-start"
			| "running"
			| "paused"
			| "awaiting-outcome"
			| "queued";
		readonly queued: number;
		readonly jobId?: IdSchema.Type;
		readonly requestId?: IdSchema.Type;
	}
}

/** Summarizes exact-line work without ticking time values that would continually postpone a debounce. */
export const readItemLineStatusesFn = (
	queue: readItemDetailQueueFx.Result,
): readonly readItemLineStatusesFn.Status[] => {
	if (queue.kind === "unavailable") return [];
	const lineUids = new Set([
		...queue.active.map((job) => job.lineUid),
		...queue.request.map((request) => request.lineUid),
	]);
	return [
		...lineUids,
	].map((lineUid) => {
		const active = queue.active.find((job) => job.lineUid === lineUid);
		const requests = queue.request.filter((request) => request.lineUid === lineUid);
		const first = requests[0];
		const state =
			active !== undefined
				? active.status
				: queue.active.length > 0
					? "queued"
					: first?.status === "waiting-inputs"
						? "waiting-inputs"
						: first?.status === "blocked-condition"
							? "waiting-start"
							: "queued";
		return {
			lineUid,
			state,
			queued: requests.length,
			...(active === undefined
				? {}
				: {
						jobId: active.jobId,
					}),
			requestId: first?.requestId,
		};
	});
};
