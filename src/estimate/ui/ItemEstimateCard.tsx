import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ArtworkCardLink } from "~/ui/ui/ArtworkCardLink";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { Tx } from "~/translation/ui/Tx";

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
export const ItemEstimateCard = ({
	estimate,
	item,
	maximumDemand,
	projectId,
}: {
	readonly estimate: ItemEstimateIndexEntry;
	readonly item: ItemSchema.Type;
	readonly maximumDemand: number;
	readonly projectId: string;
}) => (
	<ArtworkCardLink
		to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
		params={{
			projectId,
			itemUid: item.uid,
			sectionId: "estimate",
		}}
		preload="intent"
		data-ui="EditorItemEstimateCard"
		data-item-id={item.id}
		data-item-uid={item.uid}
		label={item.title}
		artwork={
			<EditorItemThumbnail
				className="aspect-square h-auto w-66 max-w-full rounded-none border-0 bg-transparent"
				resourceIds={item.asset.default}
			/>
		}
		details={
			<dl className="grid min-w-0 shrink-0 gap-1 text-right text-xs tabular-nums">
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">
						<Tx label="Estimate" />:
					</dt>
					<dd className="font-semibold text-foreground">{runtimeLabelFn(estimate)}</dd>
				</div>
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">
						<Tx label="Demand" />:
					</dt>
					<dd className="font-semibold text-foreground">
						{demandLabelFn(estimate.demand, maximumDemand)}
					</dd>
				</div>
			</dl>
		}
	/>
);
