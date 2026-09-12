import type { AcquisitionRoute } from "~/flow/type/AcquisitionGraph";

/** Cadence bounds throughput; queue delays and the first impulse remain optimistic omissions. */
export const readEstimateRouteDurationFn = (route: AcquisitionRoute, actionRuns: number) =>
	Math.max(route.durationMs, route.minimumActionIntervalMs ?? 0) * actionRuns;
