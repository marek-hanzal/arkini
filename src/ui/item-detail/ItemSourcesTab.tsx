import type { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const SourceArtwork = ({
	compositeUrl,
	sourceUrl,
}: {
	readonly compositeUrl?: string;
	readonly sourceUrl: string;
}) => (
	<div className="relative size-12 shrink-0">
		<img
			className="absolute inset-0 size-full object-contain drop-shadow-[0_0.35rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_30%,transparent)]"
			src={sourceUrl}
			alt=""
			draggable={false}
		/>
		{compositeUrl === undefined ? null : (
			<img
				className="absolute inset-0 size-full object-contain drop-shadow-[0_0.35rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_30%,transparent)]"
				src={compositeUrl}
				alt=""
				draggable={false}
			/>
		)}
	</div>
);

const SourceRow = ({
	disabled,
	source,
}: {
	readonly disabled: boolean;
	readonly source: useItemDetailSources.Source;
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
				className="group flex w-full min-w-0 cursor-pointer items-center justify-between gap-4 rounded-lg text-left outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={disabled}
				data-ui="ItemSourceDetailLink"
				onClick={() => {
					if (source.ownerItemId !== undefined) {
						RendererRuntime.runSync(
							itemDetail.openItemDetailFx({
								itemId: source.ownerItemId,
								tab: "lines",
							}),
						);
						return;
					}
					RendererRuntime.runSync(
						itemDetail.openItemDefinitionDetailFx({
							itemId: source.ownerDefinitionItemId,
						}),
					);
				}}
			>
				<div className="flex min-w-0 items-center gap-3">
					<SourceArtwork
						compositeUrl={source.compositeUrl}
						sourceUrl={source.sourceUrl}
					/>
					<div className="min-w-0">
						<h3 className="truncate text-base font-semibold text-foreground">
							{source.title}
						</h3>
						<p className="mt-0.5 text-sm text-muted">
							{source.space === undefined
								? "Configured source"
								: `Space ${source.space + 1}`}
						</p>
					</div>
				</div>
				<span
					className="icon-[lucide--chevron-right] size-5 shrink-0 text-muted transition-colors group-hover:text-accent"
					aria-hidden="true"
				/>
			</button>
		</article>
	);
};

/** Renders exact owned Board producers that visibly produce the inspected item. */
export const ItemSourcesTab = ({
	disabled = false,
	sources,
}: {
	readonly disabled?: boolean;
	readonly sources: Extract<
		useItemDetailSources.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<Scrollable
		className="h-full flex-1 pr-1"
		data-ui="ItemSourcesTab"
	>
		<div className="ak-list grid gap-1">
			{sources.source.map((source) => (
				<SourceRow
					key={source.ownerItemId ?? source.ownerDefinitionItemId}
					disabled={disabled}
					source={source}
				/>
			))}
		</div>
	</Scrollable>
);
