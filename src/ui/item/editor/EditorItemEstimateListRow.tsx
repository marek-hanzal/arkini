import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import { ButtonLink } from "~/ui/button/Button";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

const runtimeLabel = (estimate: EditorItemEstimateIndexEntry) => {
	if (estimate.status === "partial") return "Partial";
	if (estimate.status === "unreachable") return "No path";
	if (estimate.runtimeMs === undefined) return "—";
	const duration = RendererRuntime.runSync(formatItemDurationFx(estimate.runtimeMs));
	return duration;
};

/** Presents one compact projection of the cached static estimate. */
export const EditorItemEstimateListRow = ({
	estimate,
	item,
	projectId,
}: {
	readonly estimate: EditorItemEstimateIndexEntry;
	readonly item: EditorItem;
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
			<p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
				{runtimeLabel(estimate)}
			</p>
		</ButtonLink>
	</article>
);
