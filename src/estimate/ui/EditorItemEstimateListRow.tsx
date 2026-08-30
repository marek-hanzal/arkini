import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { EditorItemEstimateIndexEntry } from "~/estimate/domain/EditorItemEstimateIndex";
import { ButtonLink } from "~/ui/button/Button";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { EditorItemThumbnail } from "~/ui/item/EditorItemThumbnail";

const runtimeLabel = (estimate: EditorItemEstimateIndexEntry) => {
	if (estimate.status === "partial") return "Partial";
	if (estimate.status === "unreachable") return "No path";
	if (estimate.runtimeMs === undefined) return "—";
	const duration = formatDurationFn(estimate.runtimeMs);
	return `≈ ${duration}`;
};

const demandFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 2,
});

const demandRatioLabel = (demand: number, maximumDemand: number) => {
	const percentage = maximumDemand <= 0 ? 0 : (demand / maximumDemand) * 100;
	if (percentage <= 0.1) return "negligible";
	return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
};

/** Presents one compact projection of the cached static estimate. */
export const EditorItemEstimateListRow = ({
	estimate,
	item,
	maximumDemand,
	projectId,
}: {
	readonly estimate: EditorItemEstimateIndexEntry;
	readonly item: ItemSchema.Type;
	readonly maximumDemand: number;
	readonly projectId: string;
}) => (
	<article
		className="ak-list-row ak-list-row-interactive flex min-w-0 items-center gap-4 rounded-xl p-3"
		data-estimate-method={estimate.method}
		data-estimate-status={estimate.status}
		data-item-id={item.id}
		data-item-uid={item.uid}
		data-ui="EditorItemEstimateRow"
	>
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId,
				itemUid: item.uid,
				sectionId: "estimate",
			}}
			className="min-h-0 min-w-0 flex-1 justify-start gap-4 border-0 bg-transparent p-0 text-left shadow-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent"
		>
			<EditorItemThumbnail resourceIds={item.asset.default} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-base font-semibold">{item.title}</span>
				<span className="mt-1 block truncate text-xs text-subtle">{item.id}</span>
			</span>
			<dl className="grid shrink-0 gap-1 text-right text-sm tabular-nums">
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">Estimate:</dt>
					<dd className="font-semibold text-foreground">{runtimeLabel(estimate)}</dd>
				</div>
				<div className="flex items-baseline justify-end gap-1.5">
					<dt className="text-muted">Approx. demand:</dt>
					<dd className="font-semibold text-foreground">
						{demandFormatter.format(estimate.demand)} (
						{demandRatioLabel(estimate.demand, maximumDemand)})
					</dd>
				</div>
			</dl>
		</ButtonLink>
	</article>
);
