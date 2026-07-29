import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useWithdrawItemDetailLine } from "~/bridge/item-detail/useWithdrawItemDetailLine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { Button } from "~/ui/button/Button";
import { ItemReferenceButton } from "~/ui/item-detail/ItemReferenceButton";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const MaterialInputWithdraw = ({
	disabled,
	input,
	lineId,
	ownerItemId,
}: {
	readonly disabled: boolean;
	readonly input: Extract<
		ItemDetailLines.Input,
		{
			readonly kind: "materials";
		}
	>;
	readonly lineId: string;
	readonly ownerItemId: string;
}) => {
	const itemDetail = useItemDetailControl();
	const pendingKey = JSON.stringify([
		"line-input",
		ownerItemId,
		lineId,
		input.inputIndex,
		"withdraw",
	]);
	const withdraw = useWithdrawItemDetailLine({
		pendingKey,
		pendingOwner: itemDetail,
	});
	const pending = withdraw.pending;
	const error = withdraw.error;

	return (
		<div className="flex flex-col items-end">
			<Button
				className="min-h-7 px-2.5 py-1 text-xs"
				cursorIntent={pending ? "progress" : undefined}
				data-ui="TileLineInputWithdrawButton"
				disabled={disabled || !input.canWithdraw}
				onClick={() =>
					withdraw.run({
						ownerItemId,
						lineId,
						inputIndex: input.inputIndex,
					})
				}
			>
				{pending ? "Withdrawing…" : "Withdraw"}
			</Button>
			{error === null ? null : <p className="mt-1 text-xs text-danger">{error}</p>}
		</div>
	);
};

/** Keeps exact buffered-input recovery available when the line body is unavailable. */
export const ItemLineUnavailableWithdrawals = ({
	disabled,
	input,
	lineId,
	ownerItemId,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLines.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
}) => {
	const buffered = input.filter(
		(
			candidate,
		): candidate is Extract<
			ItemDetailLines.Input,
			{
				readonly kind: "materials";
			}
		> => candidate.kind === "materials" && candidate.canWithdraw,
	);
	if (buffered.length === 0) return null;
	return (
		<div
			className="mt-4 ml-auto flex flex-wrap justify-end gap-2"
			data-ui="TileLineUnavailableWithdrawals"
		>
			{buffered.map((candidate) => (
				<MaterialInputWithdraw
					key={candidate.inputIndex}
					disabled={disabled}
					input={candidate}
					lineId={lineId}
					ownerItemId={ownerItemId}
				/>
			))}
		</div>
	);
};

const ItemLineInputTitle = ({
	detail,
	disabled,
	label,
}: {
	readonly detail?: ItemDetailLines.DetailReference;
	readonly disabled: boolean;
	readonly label: string;
}) =>
	detail === undefined ? (
		<p className="truncate font-medium text-foreground">{label}</p>
	) : (
		<ItemReferenceButton
			compositeUrl={detail.compositeUrl}
			dataUi="TileLineInputDetailLink"
			definitionItemId={detail.itemId}
			disabled={disabled}
			label={label}
			runtimeItemId={detail.detailItemId}
			sourceUrl={detail.sourceUrl}
		/>
	);

const MaterialInputAutofillAvailability = ({
	disabled,
	input,
	label,
}: {
	readonly disabled: boolean;
	readonly input: Extract<
		ItemDetailLines.Input,
		{
			readonly kind: "materials";
		}
	>;
	readonly label: string;
}) => {
	const itemDetail = useItemDetailControl();
	const producerItemId = input.producerItemId;
	return (
		<p
			className="mt-0.5 text-xs text-muted"
			data-ui="TileLineInputAutofillAvailability"
		>
			{input.autofillAvailableQuantity > 0 ? (
				`${input.autofillAvailableQuantity} available`
			) : producerItemId === undefined ? (
				"None available"
			) : (
				<>
					<button
						type="button"
						className="cursor-pointer font-medium text-accent underline decoration-accent/55 underline-offset-2 transition-colors hover:text-accent-hover disabled:cursor-default disabled:text-muted disabled:no-underline"
						disabled={disabled}
						data-ui="TileLineInputProducerLink"
						onClick={(event) =>
							RendererRuntime.runSync(
								itemDetail.openItemDetailFx({
									itemId: producerItemId,
									linesSearchQuery: label,
									origin: event.currentTarget,
									tab: "lines",
								}),
							)
						}
					>
						None
					</button>{" "}
					available
				</>
			)}
		</p>
	);
};

const ItemLineInputRow = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale,
}: {
	readonly disabled: boolean;
	readonly input: ItemDetailLines.Input;
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale: boolean;
}) =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) => {
				const label =
					materials.selector.kind === "tag"
						? materials.selector.label
								.replaceAll(":", " ")
								.replaceAll("-", " ")
								.replaceAll("_", " ")
								.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
						: materials.selector.label;
				return (
					<div
						className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
						data-ui="TileLineInput"
						data-input-kind="materials"
					>
						<div className="min-w-0">
							<ItemLineInputTitle
								detail={materials.detail}
								disabled={disabled}
								label={label}
							/>
							<p className="mt-0.5 text-xs text-muted">
								{materials.mode === "consume" ? "Consumed" : "Reserved"}
								{materials.charges === undefined
									? ""
									: ` · ${materials.charges.cost} charge${materials.charges.cost === 1 ? "" : "s"} from ${materials.charges.from === "self" ? "owner" : "target"}`}
							</p>
						</div>
						{stale ? null : (
							<div className="flex flex-col items-end text-right">
								<div className="flex items-start justify-end gap-2">
									<MaterialInputWithdraw
										disabled={disabled}
										input={materials}
										lineId={lineId}
										ownerItemId={ownerItemId}
									/>
									<p
										className={`pt-1 font-medium text-foreground ${materials.deliveryQuantity > 0 ? "opacity-70" : ""}`}
										data-ui={
											materials.deliveryQuantity > 0
												? "TileLineInputDeliveryQuantity"
												: "TileLineInputStoredQuantity"
										}
									>
										{materials.deliveryQuantity > 0
											? materials.deliveryQuantity
											: materials.storedQuantity}{" "}
										/{" "}
										{materials.required.min === materials.required.max
											? materials.required.min
											: `${materials.required.min}–${materials.required.max}`}{" "}
										{materials.deliveryQuantity > 0 ? "on the way" : "stored"}
									</p>
								</div>
								<MaterialInputAutofillAvailability
									disabled={disabled}
									input={materials}
									label={label}
								/>
							</div>
						)}
					</div>
				);
			},
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) => {
				const label =
					deposit.selector.kind === "tag"
						? deposit.selector.label
								.replaceAll(":", " ")
								.replaceAll("-", " ")
								.replaceAll("_", " ")
								.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
						: deposit.selector.label;
				return (
					<div
						className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
						data-ui="TileLineInput"
						data-input-kind="deposit"
					>
						<div className="min-w-0">
							<ItemLineInputTitle
								detail={deposit.detail}
								disabled={disabled}
								label={label}
							/>
							<p className="mt-0.5 text-xs text-muted">
								Board · {deposit.distance}
								{deposit.charges === undefined
									? ""
									: ` · ${deposit.charges.cost} charge${deposit.charges.cost === 1 ? "" : "s"} from ${deposit.charges.from === "self" ? "owner" : "target"}`}
							</p>
						</div>
						{stale ? null : (
							<div className="text-right">
								<p className="font-medium text-foreground">
									{deposit.availableChargesLabel === "None"
										? "None available"
										: `${deposit.requiredCharges} / ${deposit.availableChargesLabel} available`}
								</p>
								{deposit.targetTitles.length === 0 ? null : (
									<p className="mt-0.5 max-w-56 truncate text-xs text-muted">
										{deposit.targetTitles.join(", ")}
									</p>
								)}
							</div>
						)}
					</div>
				);
			},
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => (
				<div
					className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
					data-ui="TileLineInput"
					data-input-kind="simple"
				>
					<p className="font-medium text-foreground">Owner charge</p>
					<p className="text-right text-sm text-muted">
						{simple.charges.cost} charge{simple.charges.cost === 1 ? "" : "s"} from{" "}
						{simple.charges.from === "self" ? "owner" : "target"}
					</p>
				</div>
			),
		)
		.exhaustive();

/** Renders the full authored input side of one visible product line. */
export const ItemLineInputs = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale = false,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLines.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale?: boolean;
}) => (
	<section className="min-w-0">
		<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			Inputs
		</h4>
		{input.length === 0 ? (
			<p className="py-3 text-sm text-muted">No material input required.</p>
		) : (
			<div className="divide-y divide-line/60">
				{input.map((entry, index) => (
					<ItemLineInputRow
						key={`${entry.kind}:${index}`}
						disabled={disabled}
						input={entry}
						lineId={lineId}
						ownerItemId={ownerItemId}
						stale={stale}
					/>
				))}
			</div>
		)}
	</section>
);
