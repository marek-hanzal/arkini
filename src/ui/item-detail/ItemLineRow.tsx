import { useAutofillItemDetailLine } from "~/bridge/item-detail/useAutofillItemDetailLine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useSetDefaultItemDetailLine } from "~/bridge/item-detail/useSetDefaultItemDetailLine";
import { useStartPendingItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import { useUnsetDefaultItemDetailLine } from "~/bridge/item-detail/useUnsetDefaultItemDetailLine";
import { useWithdrawItemDetailLine } from "~/bridge/item-detail/useWithdrawItemDetailLine";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { ItemLineInputs } from "~/ui/item-detail/ItemLineInputs";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import { ItemLineRuntime } from "~/ui/item-detail/ItemLineRuntime";
import { ItemLineSummary } from "~/ui/item-detail/ItemLineSummary";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

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
	const pendingKey = JSON.stringify([
		"line",
		ownerItemId,
		line.lineId,
	]);
	const pendingOptions = {
		pendingKey,
		pendingOwner: itemDetail,
	} as const;
	const autofillLine = useAutofillItemDetailLine(pendingOptions);
	const setDefaultLine = useSetDefaultItemDetailLine(pendingOptions);
	const unsetDefaultLine = useUnsetDefaultItemDetailLine(pendingOptions);
	const startLine = useStartPendingItemDetailLine(pendingOptions);
	const withdrawLine = useWithdrawItemDetailLine(pendingOptions);
	readSettledAsyncResultError(autofillLine.result);
	readSettledAsyncResultError(setDefaultLine.result);
	readSettledAsyncResultError(unsetDefaultLine.result);
	readSettledAsyncResultError(startLine.result);
	readSettledAsyncResultError(withdrawLine.result);
	const pendingAction = itemDetail.readPendingAction(pendingKey);
	const error = itemDetail.readActionError(pendingKey);

	return (
		<article
			className={`ak-list-row rounded-xl border-b border-l-2 border-line px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5 ${line.activeJob === undefined ? "border-l-line/55" : "ak-list-row-active border-l-success"}`}
			data-ui="TileLine"
			data-line-id={line.lineId}
			data-active={line.activeJob === undefined ? "false" : "true"}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<ItemLineSummary line={line} />
				<div className="flex shrink-0 flex-col items-end gap-3">
					<ItemLineRuntime line={line} />
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							className="min-h-8 px-3 py-1 text-xs"
							cursorIntent={pendingAction === "default" ? "progress" : undefined}
							data-ui="TileLineSetDefaultButton"
							data-default={line.isDefault ? "true" : "false"}
							disabled={disabled || pendingAction !== null}
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
							{pendingAction === "default"
								? "Saving…"
								: line.isDefault
									? "Unset default"
									: "Set default"}
						</Button>
						<Button
							cursorIntent={pendingAction === "autofill" ? "progress" : undefined}
							disabled={
								disabled || !line.actions.canAutofill || pendingAction !== null
							}
							onClick={() =>
								autofillLine.run({
									ownerItemId,
									lineId: line.lineId,
								})
							}
						>
							{pendingAction === "autofill" ? "Filling…" : "Autofill"}
						</Button>
						<Button
							cursorIntent={pendingAction === "withdraw" ? "progress" : undefined}
							disabled={
								disabled || !line.actions.canWithdraw || pendingAction !== null
							}
							onClick={() =>
								withdrawLine.run({
									ownerItemId,
									lineId: line.lineId,
								})
							}
						>
							{pendingAction === "withdraw" ? "Withdrawing…" : "Withdraw"}
						</Button>
						<PrimaryButton
							className="min-w-24"
							cursorIntent={pendingAction === "start" ? "progress" : undefined}
							data-ui="TileLineStartButton"
							data-start-mode={line.startMode}
							disabled={
								disabled ||
								line.availability.kind !== "ready" ||
								pendingAction !== null
							}
							onClick={() =>
								startLine.start({
									ownerItemId,
									lineId: line.lineId,
								})
							}
						>
							{pendingAction === "start"
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
			<div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<ItemLineInputs
					disabled={disabled}
					input={line.input}
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
		</article>
	);
};
