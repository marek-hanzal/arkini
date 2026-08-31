import { ChevronRight } from "lucide-react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { readItemDetailSourcesFx } from "~/item-detail-read/fx/readItemDetailSourcesFx";
import { ItemIdentity } from "~/ui/ui/ItemIdentity";
import { Scrollable } from "~/ui/ui/Scrollable";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

interface ItemDetailSource {
	readonly ownerItemId: string;
	readonly ownerDefinitionItemId: string;
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
	readonly space?: number;
	readonly line: readonly {
		readonly lineId: string;
		readonly title: string;
		readonly output: readonly readItemDetailSourcesFx.OutputFact[];
	}[];
}

interface ItemDetailSources {
	readonly itemId: string;
	readonly kind: "available";
	readonly targetTitle: string;
	readonly source: readonly ItemDetailSource[];
}

const SourceRow = ({
	disabled,
	source,
	stale,
	targetTitle,
}: {
	readonly disabled: boolean;
	readonly source: ItemDetailSource;
	readonly stale: boolean;
	readonly targetTitle: string;
}) => {
	const itemDetail = useItemDetailControl();
	return (
		<article
			className="ak-list-row border-b border-line px-3 py-4 last:border-b-0"
			data-ui="ItemSource"
			data-owner-item-id={source.ownerItemId}
			data-owner-definition-item-id={source.ownerDefinitionItemId}
		>
			<button
				type="button"
				className="group flex w-full min-w-0 cursor-pointer items-center justify-between gap-4 rounded-lg text-left outline-none transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
				disabled={disabled}
				data-ui="ItemSourceDetailLink"
				onClick={() =>
					RendererRuntime.runSync(
						itemDetail.openItemDetailFx({
							itemId: source.ownerItemId,
							tab: "lines",
							linesSearchQuery: targetTitle,
						}),
					)
				}
			>
				<ItemIdentity
					compositeUrl={source.compositeUrl}
					description={
						stale ? null : (
							<p className="mt-0.5 text-sm text-muted">
								{source.space === undefined
									? "Owned source"
									: `Space ${source.space + 1}`}
							</p>
						)
					}
					size="md"
					sourceUrl={source.sourceUrl}
					title={source.title}
					titleClassName="truncate text-base font-semibold text-foreground"
					titleTag="h3"
				/>
				<ChevronRight className="size-5 shrink-0 text-muted transition-colors group-hover:text-accent" />
			</button>
		</article>
	);
};

/** Renders exact owned Board producers that visibly produce the inspected item. */
export const ItemSourcesTab = ({
	disabled = false,
	sources,
	stale = false,
}: {
	readonly disabled?: boolean;
	readonly sources: ItemDetailSources;
	readonly stale?: boolean;
}) => (
	<Scrollable
		className="h-full flex-1 pr-1"
		data-ui="ItemSourcesTab"
	>
		<div className="ak-list grid gap-1">
			{sources.source.map((source) => (
				<SourceRow
					key={source.ownerItemId}
					disabled={disabled}
					source={source}
					stale={stale}
					targetTitle={sources.targetTitle}
				/>
			))}
		</div>
	</Scrollable>
);
