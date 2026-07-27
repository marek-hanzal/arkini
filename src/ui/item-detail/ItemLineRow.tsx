import { match } from "ts-pattern";

import { useAutofillItemDetailLine } from "~/bridge/item-detail/useAutofillItemDetailLine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useSetDefaultItemDetailLine } from "~/bridge/item-detail/useSetDefaultItemDetailLine";
import { useStartPendingItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
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
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

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

/** Renders one live product line with its commands, runtime, inputs, and outputs. */
export const ItemLineRow = ({
	disabled,
	line,
	ownerItemId,
}: {
	readonly disabled: boolean;
	readonly line: ItemDetailLines.Line;
	readonly ownerItemId: string;
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
		autofill: pendingKey("autofill"),
		default: pendingKey("default"),
		start: pendingKey("start"),
		withdraw: pendingKey("withdraw"),
	} as const;
	const autofillLine = useAutofillItemDetailLine({
		pendingKey: pendingKeys.autofill,
		pendingOwner: itemDetail,
	});
	const setDefaultLine = useSetDefaultItemDetailLine({
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
	});
	const unsetDefaultLine = useUnsetDefaultItemDetailLine({
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
	});
	const startLine = useStartPendingItemDetailLine({
		pendingKey: pendingKeys.start,
		pendingOwner: itemDetail,
	});
	const withdrawLine = useWithdrawItemDetailLine({
		pendingKey: pendingKeys.withdraw,
		pendingOwner: itemDetail,
	});
	readSettledAsyncResultError(autofillLine.result);
	readSettledAsyncResultError(setDefaultLine.result);
	readSettledAsyncResultError(unsetDefaultLine.result);
	readSettledAsyncResultError(startLine.result);
	readSettledAsyncResultError(withdrawLine.result);
	const pending = {
		autofill: itemDetail.readPendingAction(pendingKeys.autofill) === "autofill",
		default: itemDetail.readPendingAction(pendingKeys.default) === "default",
		start: itemDetail.readPendingAction(pendingKeys.start) === "start",
		withdraw: itemDetail.readPendingAction(pendingKeys.withdraw) === "withdraw",
	} as const;
	const error =
		Object.values(pendingKeys)
			.map((key) => itemDetail.readActionError(key))
			.find((message) => message !== null) ?? null;
	const unavailable = line.availability.kind === "unavailable";
	const unavailableDependency =
		line.availability.kind === "unavailable"
			? readUnavailableDependency(line.availability.reason)
			: undefined;

	return (
		<article
			className={`ak-list-row rounded-xl border-b border-l-2 border-line px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5 ${line.activeJob === undefined ? "border-l-line/55" : "ak-list-row-active border-l-success"}`}
			data-ui="TileLine"
			data-line-id={line.lineId}
			data-active={line.activeJob === undefined ? "false" : "true"}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<ItemLineSummary line={line} />
					{unavailableDependency === undefined ? null : (
						<ItemLineUnavailableDependency
							dependency={unavailableDependency}
							disabled={disabled}
						/>
					)}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-3">
					<ItemLineRuntime line={line} />
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
							cursorIntent={pending.autofill ? "progress" : undefined}
							disabled={disabled || unavailable || !line.actions.canAutofill}
							onClick={() =>
								autofillLine.run({
									ownerItemId,
									lineId: line.lineId,
								})
							}
						>
							{pending.autofill ? "Filling…" : "Autofill"}
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
							className="min-w-24"
							cursorIntent={pending.start ? "progress" : undefined}
							data-ui="TileLineStartButton"
							data-start-mode={line.startMode}
							disabled={disabled || !line.actions.canStart}
							onClick={() =>
								startLine.start({
									ownerItemId,
									lineId: line.lineId,
								})
							}
						>
							{pending.start
								? line.startMode === "enqueue"
									? "Queueing…"
									: "Starting…"
								: line.startMode === "enqueue"
									? "Enqueue"
									: "Start"}
						</PrimaryButton>
					</div>
				</div>
			</div>
			{error === null ? null : (
				<p
					className="mt-3 text-sm text-danger"
					role="status"
				>
					{error}
				</p>
			)}
			{line.availability.kind === "unavailable" && unavailableDependency === undefined ? (
				<div
					className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-sm text-muted"
					data-ui="TileLineUnavailableReason"
				>
					<span
						className="icon-[lucide--circle-alert] size-5 shrink-0 text-warning"
						aria-hidden="true"
					/>
					<ItemLineUnavailableReason reason={line.availability.reason} />
					<ItemLineUnavailableWithdrawals
						disabled={disabled}
						input={line.input}
						lineId={line.lineId}
						ownerItemId={ownerItemId}
					/>
				</div>
			) : line.availability.kind === "unavailable" ? (
				<ItemLineUnavailableWithdrawals
					disabled={disabled}
					input={line.input}
					lineId={line.lineId}
					ownerItemId={ownerItemId}
				/>
			) : (
				<div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
					<ItemLineInputs
						disabled={disabled}
						input={line.input}
						lineId={line.lineId}
						ownerItemId={ownerItemId}
					/>
					<div
						className="grid place-items-center text-muted"
						aria-hidden="true"
						data-ui="TileLineFlowChevron"
					>
						<span className="icon-[lucide--chevron-right] size-5" />
					</div>
					<ItemLineOutputs
						disabled={disabled}
						output={line.output}
					/>
				</div>
			)}
		</article>
	);
};
