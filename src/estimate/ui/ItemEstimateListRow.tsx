import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ListRow } from "~/item-authoring/ui/ListRow";

const runtimeLabelFn = (estimate: ItemEstimateIndexEntry) => {
	if (estimate.status === "partial") return "Partial";
	if (estimate.status === "unreachable") return "No path";
	if (estimate.runtimeMs === undefined) return "—";
	const duration = formatDurationFn(estimate.runtimeMs);
	return `≈ ${duration}`;
};

const demandFormatter = new Intl.NumberFormat("en-US");

const demandRatioLabelFn = (demand: number, maximumDemand: number) => {
	const percentage = maximumDemand <= 0 ? 0 : (demand / maximumDemand) * 100;
	if (percentage <= 0.1) return "negligible";
	return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
};

const demandLabelFn = (demand: number, maximumDemand: number) => {
	const roundedDemand = Math.ceil(demand);
	return `${demandFormatter.format(roundedDemand)} (${demandRatioLabelFn(
		roundedDemand,
		Math.ceil(maximumDemand),
	)})`;
};

/** Presents one compact projection of the cached static estimate. */
export const ItemEstimateListRow = ({
	activeType,
	estimate,
	item,
	maximumDemand,
	onSelectTypeFn,
	projectId,
}: {
	readonly activeType: TypeSchema.Type | undefined;
	readonly estimate: ItemEstimateIndexEntry;
	readonly item: ItemSchema.Type;
	readonly maximumDemand: number;
	readonly onSelectTypeFn: (type: TypeSchema.Type) => void;
	readonly projectId: string;
}) => (
	<ListRow
		activeType={activeType}
		dataUi="EditorItemEstimateRow"
		item={item}
		onSelectTypeFn={onSelectTypeFn}
		projectId={projectId}
		sectionId="estimate"
		details={
			<dl className="pointer-events-none grid shrink-0 gap-1 text-right text-sm tabular-nums">
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">Estimate:</dt>
					<dd className="font-semibold text-foreground">{runtimeLabelFn(estimate)}</dd>
				</div>
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">Demand:</dt>
					<dd className="font-semibold text-foreground">
						{demandLabelFn(estimate.demand, maximumDemand)}
					</dd>
				</div>
			</dl>
		}
	/>
);
