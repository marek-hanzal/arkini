import { match } from "ts-pattern";

import type { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { Button } from "~/ui/button/Button";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const formatQuantity = ({ min, max }: { readonly min: number; readonly max: number }) =>
	min === max ? `${min}×` : `${min}–${max}×`;

const formatSelections = ({ min, max }: { readonly min: number; readonly max: number }) =>
	min === max ? `${min} selection${min === 1 ? "" : "s"}` : `${min}–${max} selections`;

const formatOutputFact = (fact: useItemDetailSources.OutputFact) => {
	const quantity = formatQuantity(fact.quantity);
	const alternative =
		fact.totalSetWeight === fact.setWeight
			? ""
			: ` · alternative weight ${fact.setWeight}/${fact.totalSetWeight}`;
	return match(fact)
		.with(
			{
				kind: "guaranteed",
			},
			() => `${quantity} guaranteed${alternative}`,
		)
		.with(
			{
				kind: "chance",
			},
			({ chance }) => `${quantity} · ${Math.round(chance * 100)}% chance${alternative}`,
		)
		.with(
			{
				kind: "weight",
			},
			({ optionWeight, selections, totalOptionWeight }) =>
				`${quantity} · weight ${optionWeight}/${totalOptionWeight} · ${formatSelections(selections)}${alternative}`,
		)
		.exhaustive();
};

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
	targetTitle,
}: {
	readonly disabled: boolean;
	readonly source: useItemDetailSources.Source;
	readonly targetTitle: string;
}) => {
	const itemDetail = useItemDetailControl();
	return (
		<article
			className="ak-list-row border-b border-line px-3 py-4 last:border-b-0"
			data-ui="ItemSource"
			data-owner-item-id={source.ownerItemId}
		>
			<div className="flex min-w-0 items-center justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<SourceArtwork
						compositeUrl={source.compositeUrl}
						sourceUrl={source.sourceUrl}
					/>
					<div className="min-w-0">
						<h3 className="truncate text-base font-semibold text-foreground">
							{source.title}
						</h3>
						<p className="mt-0.5 text-sm text-muted">Space {source.space + 1}</p>
					</div>
				</div>
				<Button
					className="shrink-0"
					disabled={disabled}
					onClick={() =>
						itemDetail.openItemDetail({
							itemId: source.ownerItemId,
							tab: "lines",
						})
					}
				>
					Open Lines
				</Button>
			</div>
			<div className="mt-3 divide-y divide-line/60 border-t border-line/70">
				{source.line.map((line) => (
					<div
						key={line.lineId}
						className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-6 py-3"
						data-ui="ItemSourceLine"
						data-line-id={line.lineId}
					>
						<p className="font-medium text-foreground">{line.title}</p>
						<div className="grid gap-1 text-sm text-muted">
							{line.output.map((fact, index) => (
								<p key={`${fact.kind}:${index}`}>
									<span className="font-medium text-foreground">
										{targetTitle}
									</span>
									{" · "}
									{formatOutputFact(fact)}
								</p>
							))}
						</div>
					</div>
				))}
			</div>
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
					key={source.ownerItemId}
					disabled={disabled}
					source={source}
					targetTitle={sources.targetTitle}
				/>
			))}
		</div>
	</Scrollable>
);
