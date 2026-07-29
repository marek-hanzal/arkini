import { match } from "ts-pattern";

import { useEnqueueItemDetailLine } from "~/bridge/item-detail/useEnqueueItemDetailLine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useSetDefaultItemDetailLine } from "~/bridge/item-detail/useSetDefaultItemDetailLine";
import { useUnsetDefaultItemDetailLine } from "~/bridge/item-detail/useUnsetDefaultItemDetailLine";
import { useWithdrawItemDetailLine } from "~/bridge/item-detail/useWithdrawItemDetailLine";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { ItemLineInputs, ItemLineUnavailableWithdrawals } from "~/ui/item-detail/ItemLineInputs";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import { ItemLineRuntime } from "~/ui/item-detail/ItemLineRuntime";
import { ItemLineSummary } from "~/ui/item-detail/ItemLineSummary";
import { ItemReferenceButton } from "~/ui/item-detail/ItemReferenceButton";
import type { ItemDetailPendingAction } from "~/ui/item-detail/ItemDetailControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const ItemLineUnavailableReason = ({
	reason,
}: {
	readonly reason: ItemDetailLines.DisabledReason;
}) => {
	return match(reason)
		.with(
			{
				kind: "direct-output-max-count",
			},
			{
				kind: "downstream-output-max-count",
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

const readUnavailableDependency = (reason: ItemDetailLines.DisabledReason) => {
	if (reason.kind === "deposit-target-missing") {
		return reason.detail === undefined
			? undefined
			: {
					detail: reason.detail,
					status: `Required · None available (Board · ${reason.distance})`,
				};
	}
	if (reason.kind !== "line-disabled" || reason.cause.kind !== "enable-rule") {
		return undefined;
	}
	const detail = reason.cause.condition.detail;
	return detail === undefined
		? undefined
		: {
				detail,
				status: match(reason.cause.condition)
					.with(
						{
							kind: "exists",
						},
						({ locationLabel }) => `Required · ${locationLabel}`,
					)
					.with(
						{
							kind: "count",
						},
						({ count, locationLabel }) => `Required ${count} · ${locationLabel}`,
					)
					.with(
						{
							kind: "range",
						},
						({ locationLabel, max, min }) =>
							`Required ${min}-${max} · ${locationLabel}`,
					)
					.exhaustive(),
			};
};

const ItemLineUnavailableDependency = ({
	dependency,
	disabled,
}: {
	readonly dependency: NonNullable<ReturnType<typeof readUnavailableDependency>>;
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
			<span
				className="icon-[lucide--circle-alert] size-4 shrink-0 text-warning"
				aria-hidden="true"
			/>
		</span>
	</div>
);

const ItemLineUnavailableMessage = ({
	reason,
}: {
	readonly reason: ItemDetailLines.DisabledReason;
}) => (
	<div
		className="mt-4 flex min-w-0 items-center gap-2 text-sm text-muted"
		data-ui="TileLineUnavailableReason"
	>
		<span
			className="icon-[lucide--circle-alert] size-4 shrink-0 text-warning"
			aria-hidden="true"
		/>
		<ItemLineUnavailableReason reason={reason} />
	</div>
);

/** Renders one live product line with its commands, runtime, inputs, and outputs. */
export const ItemLineRow = ({
	disabled,
	line,
	ownerItemId,
	stale = false,
}: {
	readonly disabled: boolean;
	readonly line: ItemDetailLines.Line;
	readonly ownerItemId: string;
	readonly stale?: boolean;
}) => {
	const itemDetail = useItemDetailControl();
	const pendingKey = (action: ItemDetailPendingAction) =>
		JSON.stringify([
			"line",
			ownerItemId,
			line.lineId,
			action,
		]);
	const pendingKeys = {
		default: pendingKey("default"),
		enqueue: pendingKey("enqueue"),
		withdraw: pendingKey("withdraw"),
	} as const;
	const setDefaultLine = useSetDefaultItemDetailLine({
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
	});
	const enqueueLine = useEnqueueItemDetailLine({
		pendingKey: pendingKeys.enqueue,
		pendingOwner: itemDetail,
	});
	const unsetDefaultLine = useUnsetDefaultItemDetailLine({
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
	});
	const withdrawLine = useWithdrawItemDetailLine({
		pendingKey: pendingKeys.withdraw,
		pendingOwner: itemDetail,
	});
	const pending = {
		default: setDefaultLine.pending || unsetDefaultLine.pending,
		enqueue: enqueueLine.pending,
		withdraw: withdrawLine.pending,
	} as const;
	const error =
		[
			enqueueLine.error,
			setDefaultLine.error,
			unsetDefaultLine.error,
			withdrawLine.error,
		].find((message) => message !== null) ?? null;
	const unavailable = line.availability.kind === "unavailable";
	const unavailableDependency =
		line.availability.kind === "unavailable"
			? readUnavailableDependency(line.availability.reason)
			: undefined;
	const showUnavailableReason = !stale && unavailable && line.activeJob === undefined;
	const queued = !stale && line.activeJob === undefined && line.queuedRequestCount > 0;
	const contentReadOnly = disabled || line.activeJob !== undefined;
	const progress =
		line.activeJob === undefined
			? null
			: line.activeJob.durationMs === 0
				? 1
				: Math.max(
						0,
						Math.min(
							1,
							(line.activeJob.durationMs - line.activeJob.remainingMs) /
								line.activeJob.durationMs,
						),
					);

	return (
		<article
			className={`ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5 ${
				stale
					? "border-l-line/55"
					: line.activeJob !== undefined
						? "ak-list-row-active border-l-success"
						: queued
							? "border-l-warning bg-warning/[0.06]"
							: "border-l-line/55"
			}`}
			data-ui="TileLine"
			data-line-id={line.lineId}
			data-active={!stale && line.activeJob !== undefined ? "true" : "false"}
			data-queued={queued ? "true" : "false"}
		>
			{stale || progress === null ? null : (
				<div
					className="pointer-events-none absolute inset-y-0 right-0 left-0.5 overflow-hidden rounded-r-[inherit]"
					aria-hidden="true"
					data-ui="TileLineProgress"
				>
					<div
						className="h-full bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
						data-ui="TileLineProgressFill"
						style={{
							width: `${progress * 100}%`,
						}}
					/>
				</div>
			)}
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<ItemLineSummary
						line={line}
						stale={stale}
					/>
					{queued ? (
						<p
							className="mt-3 flex items-center gap-2 text-sm font-medium text-warning"
							data-ui="TileLineQueuedMessage"
						>
							<span
								className="icon-[lucide--clock-3] size-4 shrink-0"
								aria-hidden="true"
							/>
							Queued for automatic start when the required inputs become available.
						</p>
					) : null}
					{!showUnavailableReason ? null : unavailableDependency === undefined ? (
						<ItemLineUnavailableMessage reason={line.availability.reason} />
					) : (
						<ItemLineUnavailableDependency
							dependency={unavailableDependency}
							disabled={disabled}
						/>
					)}
				</div>
				{stale ? null : (
					<div className="flex shrink-0 flex-col items-end gap-3">
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								className="min-h-8 px-3 py-1 text-xs"
								cursorIntent={pending.default ? "progress" : undefined}
								data-ui="TileLineSetDefaultButton"
								data-default={line.isDefault ? "true" : "false"}
								disabled={disabled || unavailable}
								onClick={() => {
									if (line.isDefault) {
										unsetDefaultLine.run({
											ownerItemId,
										});
										return;
									}
									setDefaultLine.run({
										ownerItemId,
										lineId: line.lineId,
									});
								}}
							>
								{pending.default
									? "Saving…"
									: line.isDefault
										? "Unset default"
										: "Set default"}
							</Button>
							<Button
								cursorIntent={pending.withdraw ? "progress" : undefined}
								data-ui="TileLineWithdrawButton"
								disabled={disabled || !line.actions.canWithdraw}
								onClick={() =>
									withdrawLine.run({
										ownerItemId,
										lineId: line.lineId,
									})
								}
							>
								{pending.withdraw ? "Withdrawing…" : "Withdraw"}
							</Button>
							<PrimaryButton
								aria-busy={pending.enqueue}
								cursorIntent={pending.enqueue ? "progress" : undefined}
								data-ui="TileLineEnqueueButton"
								disabled={disabled || !line.actions.enqueue.enabled}
								onClick={() =>
									enqueueLine.run({
										ownerItemId,
										lineId: line.lineId,
									})
								}
							>
								Enqueue
							</PrimaryButton>
						</div>
						<ItemLineRuntime line={line} />
					</div>
				)}
			</div>
			{stale || error === null ? null : (
				<p
					className="relative z-[1] mt-3 text-sm text-danger"
					role="status"
				>
					{error}
				</p>
			)}
			{!stale && unavailable && line.activeJob === undefined ? (
				<div className="relative z-[1]">
					<ItemLineUnavailableWithdrawals
						disabled={disabled}
						input={line.input}
						lineId={line.lineId}
						ownerItemId={ownerItemId}
					/>
				</div>
			) : (
				<div className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
					<ItemLineInputs
						disabled={contentReadOnly}
						input={line.input}
						lineId={line.lineId}
						ownerItemId={ownerItemId}
						stale={stale}
						suppressSurface={line.activeJob !== undefined}
					/>
					<div
						className="grid place-items-center text-muted"
						aria-hidden="true"
						data-ui="TileLineFlowChevron"
					>
						<span className="icon-[lucide--chevron-right] size-5" />
					</div>
					<ItemLineOutputs
						disabled={contentReadOnly}
						output={line.output}
					/>
				</div>
			)}
		</article>
	);
};
