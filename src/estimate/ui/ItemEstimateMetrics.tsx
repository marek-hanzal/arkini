import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { useTranslator } from "~/translation/ui/useTranslator";

const demandFormatter = new Intl.NumberFormat("en-US");

const demandRatioLabelFn = (demand: number, maximumDemand: number, negligible: string) => {
	const percentage = maximumDemand <= 0 ? 0 : (demand / maximumDemand) * 100;
	if (percentage <= 0.1) return negligible;
	return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
};

const demandLabelFn = (demand: number, maximumDemand: number, negligible: string) => {
	const roundedDemand = Math.ceil(demand);
	return `${demandFormatter.format(roundedDemand)} (${demandRatioLabelFn(
		roundedDemand,
		Math.ceil(maximumDemand),
		negligible,
	)})`;
};

/** Shared timing and demand projection for artwork catalog cards. */
export const ItemEstimateMetrics = ({
	estimate,
	maximumDemand,
}: {
	readonly estimate?: ItemEstimateIndexEntry;
	readonly maximumDemand: number;
}) => {
	const translator = useTranslator();
	const runtime =
		estimate === undefined
			? "—"
			: estimate.status === "partial"
				? translator.textFn("Partial")
				: estimate.status === "unreachable"
					? translator.textFn("Unreachable")
					: estimate.runtimeMs === undefined
						? "—"
						: `≈ ${formatDurationFn(estimate.runtimeMs)}`;
	return (
		<span className="grid min-w-0 shrink-0 gap-1 text-right text-xs font-semibold text-foreground tabular-nums">
			<span>{runtime}</span>
			<span>
				{estimate === undefined
					? "—"
					: demandLabelFn(
							estimate.demand,
							maximumDemand,
							translator.textFn("negligible"),
						)}
			</span>
		</span>
	);
};
