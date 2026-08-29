import { ChevronRight, CircleAlert, Clock3, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef } from "react";
import { Effect } from "effect";
import { match } from "ts-pattern";

import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { setDefaultLineFx } from "~/production-line/write/setDefaultLineFx";
import { unsetDefaultLineFx } from "~/production-line/write/unsetDefaultLineFx";
import { withdrawLineInputFx } from "~/production-input/write/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/write/withdrawLineInputsFx";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { itemDetailFadeMotion } from "~/item-detail-frame/ItemDetailMotion";
import { ItemLineInputs, ItemLineUnavailableWithdrawals } from "~/ui/item-detail/ItemLineInputs";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import {
	ItemLineSummary,
	type ItemLineSummaryIdentityRenderer,
} from "~/ui/item-detail/ItemLineSummary";
import { ItemReferenceButton } from "~/item-detail-frame/ItemReferenceButton";
import type { ItemDetailPendingAction } from "~/item-detail-frame/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/useItemDetailControl";
import { useItemDetailPendingCommand } from "~/item-detail-frame/useItemDetailPendingCommand";
import { formatDurationFn } from "~/ui/formatDurationFn";
import { ProductionJobRuntime } from "~/production-job/ui/ProductionJobRuntime";
import { readActiveJobRuntimeFn } from "~/production-job/ui/readActiveJobRuntimeFn";

const ItemLineUnavailableReason = ({
	reason,
}: {
	readonly reason: ItemDetailLines.DisabledReason;
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

const readUnavailableDependency = (reason: ItemDetailLines.DisabledReason) => {
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
			<CircleAlert
				className="size-4 shrink-0 text-warning"
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
		<CircleAlert
			className="size-4 shrink-0 text-warning"
			aria-hidden="true"
		/>
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
					<Info
						className="mt-0.5 size-4 shrink-0 text-secondary-foreground"
						aria-hidden="true"
					/>
					<span>{hint}</span>
				</li>
			))}
		</ul>
	);

/** Renders one live product line with its commands, runtime, inputs, and outputs. */
export const ItemLineRow = forwardRef<
	HTMLElement,
	{
		readonly definitionItemId?: string;
		readonly disabled: boolean;
		readonly line: ItemDetailLines.Line;
		readonly ownerItemId: string;
		readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
		readonly stale?: boolean;
	}
>(function ItemLineRow(
	{ definitionItemId, disabled, line, ownerItemId, renderIdentity, stale = false },
	ref,
) {
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
	const setDefaultLine = useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
		run: (game, command: setDefaultLineFx.Props) => game.runFx(setDefaultLineFx(command)),
	});
	const enqueueLine = useItemDetailPendingCommand({
		action: "enqueue",
		failureMessage: "Work could not be queued.",
		pendingKey: pendingKeys.enqueue,
		pendingOwner: itemDetail,
		run: (game, command: enqueueLineFx.Props) => game.runFx(enqueueLineFx(command)),
	});
	const unsetDefaultLine = useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey: pendingKeys.default,
		pendingOwner: itemDetail,
		run: (game, command: unsetDefaultLineFx.Props) => game.runFx(unsetDefaultLineFx(command)),
	});
	const withdrawLine = useItemDetailPendingCommand({
		action: "withdraw",
		failureMessage: "Inputs could not be withdrawn.",
		pendingKey: pendingKeys.withdraw,
		pendingOwner: itemDetail,
		run: (game, command: withdrawLineInputFx.Props | withdrawLineInputsFx.Props) =>
			game
				.runFx(
					"inputIndex" in command
						? withdrawLineInputFx(command)
						: withdrawLineInputsFx(command),
				)
				.pipe(Effect.asVoid),
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
	const contentReadOnly = disabled || line.activeJob !== undefined;
	const lineWithdraw =
		!stale &&
		line.actions.canWithdraw &&
		line.input.some(
			(candidate) => candidate.kind === "materials" && candidate.storedQuantity > 0,
		)
			? {
					disabled: contentReadOnly,
					onClick: () =>
						withdrawLine.run({
							ownerItemId,
							lineId: line.lineId,
						}),
					pending: pending.withdraw,
				}
			: undefined;
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
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: formatDurationFn(line.effectiveRuntimeMs),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${formatDurationFn(line.baseRuntimeMs)}`,
				}
			: readActiveJobRuntimeFn(activeJob);

	return (
		<motion.article
			ref={ref}
			layout
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
			{...itemDetailFadeMotion}
		>
			<AnimatePresence initial={false}>
				{stale || progress === null ? null : (
					<motion.div
						key="progress"
						animate={{
							opacity: 1,
						}}
						className="pointer-events-none absolute inset-y-0 right-0 left-0.5 overflow-hidden rounded-r-[inherit]"
						exit={{
							opacity: 0,
						}}
						initial={{
							opacity: 0,
						}}
						transition={itemDetailFadeMotion.transition}
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
					</motion.div>
				)}
			</AnimatePresence>
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
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
								<Clock3
									className="size-4 shrink-0"
									aria-hidden="true"
								/>
								Queued for automatic start when the required inputs become
								available.
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
				{stale ? null : (
					<div className="flex shrink-0 flex-col items-end gap-3">
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								className="min-h-8 px-3 py-1 text-xs"
								cursorIntent={pending.default ? "progress" : undefined}
								data-ui="TileLineSetDefaultButton"
								data-default={line.isDefault ? "true" : "false"}
								disabled={disabled || pending.default || unavailable}
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
								{line.isDefault ? "Unset default" : "Set default"}
							</Button>
							<PrimaryButton
								aria-busy={pending.enqueue}
								cursorIntent={pending.enqueue ? "progress" : undefined}
								data-ui="TileLineEnqueueButton"
								disabled={
									disabled || pending.enqueue || !line.actions.enqueue.enabled
								}
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
						<ProductionJobRuntime
							dataUi="TileLineRuntime"
							jobStatus={activeJob?.status ?? "idle"}
							runtime={runtime}
						/>
					</div>
				)}
			</div>
			<AnimatePresence initial={false}>
				{stale || error === null ? null : (
					<motion.p
						key={error}
						className="relative z-[1] mt-3 text-sm text-danger"
						role="status"
						{...itemDetailFadeMotion}
					>
						{error}
					</motion.p>
				)}
			</AnimatePresence>
			<AnimatePresence
				initial={false}
				mode="wait"
			>
				{!stale && unavailable && line.activeJob === undefined ? (
					<motion.div
						key="unavailable-inputs"
						className="relative z-[1]"
						{...itemDetailFadeMotion}
					>
						<ItemLineUnavailableWithdrawals
							disabled={disabled}
							input={line.input}
							lineId={line.lineId}
							ownerItemId={ownerItemId}
							withdraw={lineWithdraw}
						/>
					</motion.div>
				) : (
					<motion.div
						key="line-details"
						className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4"
						{...itemDetailFadeMotion}
					>
						<ItemLineInputs
							disabled={contentReadOnly}
							input={line.input}
							lineId={line.lineId}
							ownerItemId={ownerItemId}
							stale={stale}
							suppressSurface={line.activeJob !== undefined}
							withdraw={lineWithdraw}
						/>
						<div
							className="grid place-items-center text-muted"
							aria-hidden="true"
							data-ui="TileLineFlowChevron"
						>
							<ChevronRight className="size-5" />
						</div>
						<ItemLineOutputs
							disabled={contentReadOnly}
							output={line.output}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.article>
	);
});
