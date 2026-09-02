import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

/** Formats the shared quantity-one estimate result for compact Editor summaries. */
export const formatItemEstimateResultFn = (estimate: ItemEstimate) =>
	estimate.obtainable
		? `≈ ${formatDurationFn(estimate.durationMs)}`
		: estimate.status === "partial"
			? "Indeterminate"
			: "Unreachable";
