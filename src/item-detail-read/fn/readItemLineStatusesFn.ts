import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";

export namespace readItemLineStatusesFn {
	export interface Status {
		readonly lineId: IdSchema.Type;
		readonly state:
			| "idle"
			| "waiting-inputs"
			| "waiting-start"
			| "running"
			| "paused"
			| "awaiting-output"
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
	const lineIds = new Set([
		...queue.active.map((job) => job.lineId),
		...queue.request.map((request) => request.lineId),
	]);
	return [
		...lineIds,
	].map((lineId) => {
		const active = queue.active.find((job) => job.lineId === lineId);
		const requests = queue.request.filter((request) => request.lineId === lineId);
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
			lineId,
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
