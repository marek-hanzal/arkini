import { CircleAlert, Clock3, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { match } from "ts-pattern";

import { ItemReferenceButton } from "~/item-detail-frame/ui/ItemReferenceButton";
import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import {
	ItemLineSummary,
	type ItemLineSummaryIdentityRenderer,
} from "~/item-line-detail/ui/ItemLineSummary";

const ItemLineUnavailableReason = ({
	reason,
}: {
	readonly reason: ItemDetailLinesProjection.DisabledReason;
}) => {
	return match(reason)
		.with(
			{
				kind: "direct-output-capacity",
			},
			{
				kind: "downstream-output-capacity",
			},
			(limit) => (
				<p>
					<strong className="font-semibold text-foreground">{limit.itemTitle}</strong>{" "}
					{limit.messageAfterTitle}
				</p>
			),
		)
		.with(
			{
				kind: "line-disabled",
			},
			{
				kind: "owner-stored",
			},
			{
				kind: "deposit-target-missing",
			},
			({ message }) => <p>{message}</p>,
		)
		.exhaustive();
};

const readUnavailableDependencyFn = (reason: ItemDetailLinesProjection.DisabledReason) => {
	if (reason.kind === "deposit-target-missing") {
		return reason.detail === undefined
			? undefined
			: {
					detail: reason.detail,
					status: `Required · None available (Board · ${reason.distance})`,
				};
	}
	return undefined;
};

const ItemLineUnavailableDependency = ({
	dependency,
	disabled,
}: {
	readonly dependency: NonNullable<ReturnType<typeof readUnavailableDependencyFn>>;
	readonly disabled: boolean;
}) => (
	<div
		className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted"
		data-ui="TileLineUnavailableReason"
	>
		<ItemReferenceButton
			compositeUrl={dependency.detail.compositeUrl}
			dataUi="TileLineUnavailableDependencyLink"
			definitionItemId={dependency.detail.itemId}
			disabled={disabled}
			label={dependency.detail.title}
			runtimeItemId={dependency.detail.detailItemId}
			sourceUrl={dependency.detail.sourceUrl}
		/>
		<span className="flex items-center gap-1.5">
			{dependency.status}
			<CircleAlert className="size-4 shrink-0 text-warning" />
		</span>
	</div>
);

const ItemLineUnavailableMessage = ({
	reason,
}: {
	readonly reason: ItemDetailLinesProjection.DisabledReason;
}) => (
	<div
		className="mt-4 flex min-w-0 items-center gap-2 text-sm text-muted"
		data-ui="TileLineUnavailableReason"
	>
		<CircleAlert className="size-4 shrink-0 text-warning" />
		<ItemLineUnavailableReason reason={reason} />
	</div>
);

const ItemLineRuleHints = ({ hints }: { readonly hints: readonly string[] }) =>
	hints.length === 0 ? null : (
		<ul
			className="mt-3 grid gap-1.5 text-sm text-muted"
			data-ui="TileLineRuleHints"
		>
			{hints.map((hint, index) => (
				<li
					className="flex min-w-0 items-start gap-2"
					key={`${hint}-${index}`}
				>
					<Info className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
					<span>{hint}</span>
				</li>
			))}
		</ul>
	);

/** Renders one line identity together with its queue, rule, and availability status. */
export const ItemLineStatus = ({
	definitionItemId,
	disabled,
	line,
	queued,
	renderIdentity,
	stale,
}: {
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly line: ItemDetailLinesProjection.Line;
	readonly queued: boolean;
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
	readonly stale: boolean;
}) => {
	const unavailable = line.availability.kind === "unavailable";
	const unavailableDependency = unavailable
		? readUnavailableDependencyFn(line.availability.reason)
		: undefined;
	const showUnavailableReason = !stale && unavailable && line.activeJob === undefined;
	const disclosedDisabledHint =
		line.availability.kind === "unavailable" &&
		line.availability.reason.kind === "line-disabled" &&
		line.availability.reason.cause.kind !== "static"
			? line.availability.reason.message
			: undefined;
	const activeRuleHints =
		disclosedDisabledHint === undefined
			? line.activeRuleHints
			: line.activeRuleHints.filter((hint) => hint !== disclosedDisabledHint);

	return (
		<div className="min-w-0 flex-1">
			<ItemLineSummary
				disabled={disabled}
				itemId={definitionItemId}
				line={line}
				renderIdentity={renderIdentity}
				stale={stale}
			/>
			{stale ? null : <ItemLineRuleHints hints={activeRuleHints} />}
			<AnimatePresence initial={false}>
				{queued ? (
					<motion.p
						key="queued"
						className="mt-3 flex items-center gap-2 text-sm font-medium text-warning"
						data-ui="TileLineQueuedMessage"
						{...itemDetailFadeMotion}
					>
						<Clock3 className="size-4 shrink-0" />
						Queued for automatic start when the required inputs become available.
					</motion.p>
				) : null}
			</AnimatePresence>
			<AnimatePresence initial={false}>
				{!showUnavailableReason ? null : (
					<motion.div
						key="unavailable-reason"
						{...itemDetailFadeMotion}
					>
						{unavailableDependency === undefined ? (
							<ItemLineUnavailableMessage reason={line.availability.reason} />
						) : (
							<ItemLineUnavailableDependency
								dependency={unavailableDependency}
								disabled={disabled}
							/>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
