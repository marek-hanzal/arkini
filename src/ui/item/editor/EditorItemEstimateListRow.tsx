import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import { ButtonLink } from "~/ui/button/Button";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

const runtimeLabel = (runtimeMs: number | undefined) =>
	runtimeMs === undefined ? "—" : RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

/** Presents one compact all-scenario estimate and links to the item's Estimate detail. */
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
			<dl className="grid shrink-0 grid-cols-3 gap-5 text-right max-[52rem]:grid-cols-1 max-[52rem]:gap-0.5">
				{(
					[
						[
							"Expected",
							estimate.expectedRuntimeMs,
						],
						[
							"Guaranteed",
							estimate.guaranteedRuntimeMs,
						],
						[
							"Best",
							estimate.bestRuntimeMs,
						],
					] as const
				).map(([label, runtimeMs]) => (
					<div key={label}>
						<dt className="text-[0.62rem] font-semibold uppercase tracking-wider text-subtle">
							{label}
						</dt>
						<dd className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
							{runtimeLabel(runtimeMs)}
						</dd>
					</div>
				))}
			</dl>
		</ButtonLink>
	</article>
);
