import { AnimatePresence, motion } from "motion/react";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { useWithdrawItemDetailLine } from "~/ui/item-detail/useWithdrawItemDetailLine";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { LinkButton } from "~/ui/button/LinkButton";
import { itemDetailBadgeMotion, itemDetailFadeMotion } from "~/ui/item-detail/ItemDetailMotion";
import { ItemReferenceButton } from "~/ui/item-detail/ItemReferenceButton";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

export interface ItemLineInputsWithdrawAction {
	readonly disabled: boolean;
	readonly onClick: () => void;
	readonly pending: boolean;
}

const ItemLineInputsHeader = ({
	withdraw,
}: {
	readonly withdraw?: ItemLineInputsWithdrawAction;
}) => (
	<div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
		<h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Inputs</h4>
		<AnimatePresence initial={false}>
			{withdraw === undefined ? null : (
				<motion.div
					key="withdraw"
					{...itemDetailBadgeMotion}
				>
					<LinkButton
						className="text-xs"
						cursorIntent={withdraw.pending ? "progress" : undefined}
						data-ui="TileLineWithdrawButton"
						disabled={withdraw.disabled || withdraw.pending}
						onClick={withdraw.onClick}
					>
						Withdraw
					</LinkButton>
				</motion.div>
			)}
		</AnimatePresence>
	</div>
);

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
			<LinkButton
				className="text-xs"
				cursorIntent={pending ? "progress" : undefined}
				data-ui="TileLineInputWithdrawButton"
				disabled={disabled || pending || !input.canWithdraw}
				onClick={() =>
					withdraw.run({
						ownerItemId,
						lineId,
						inputIndex: input.inputIndex,
					})
				}
			>
				Withdraw
			</LinkButton>
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
	withdraw,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLines.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly withdraw?: ItemLineInputsWithdrawAction;
}) => {
	const buffered = input.filter(
		(
			candidate,
		): candidate is Extract<
			ItemDetailLines.Input,
			{
				readonly kind: "materials";
			}
		> =>
			candidate.kind === "materials" && candidate.storedQuantity > 0 && candidate.canWithdraw,
	);
	if (buffered.length === 0) return null;
	return (
		<section
			className="mt-4 min-w-0"
			data-ui="TileLineUnavailableWithdrawals"
		>
			<ItemLineInputsHeader withdraw={withdraw} />
			<div className="ml-auto flex flex-wrap justify-end gap-2 pt-3">
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
		</section>
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
	const availabilityKey =
		input.autofillAvailableQuantity > 0
			? `available:${input.autofillAvailableQuantity}`
			: producerItemId === undefined
				? "none"
				: `producer:${producerItemId}`;
	return (
		<AnimatePresence
			initial={false}
			mode="popLayout"
		>
			<motion.p
				key={availabilityKey}
				className="mt-0.5 text-xs text-muted"
				data-ui="TileLineInputAutofillAvailability"
				{...itemDetailFadeMotion}
			>
				{input.autofillAvailableQuantity > 0 ? (
					`${input.autofillAvailableQuantity} available`
				) : producerItemId === undefined ? (
					"None available"
				) : (
					<>
						<LinkButton
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
						</LinkButton>{" "}
						available
					</>
				)}
			</motion.p>
		</AnimatePresence>
	);
};

const inputSurfaceClassName = {
	available: "bg-[var(--ak-list-row-active-surface)]",
	delivery: "bg-[var(--ak-line-input-delivery-surface)]",
	empty: "bg-transparent",
	stored: "bg-[var(--ak-list-row-active-progress-surface)]",
} as const;

const readItemLineInputState = (input: ItemDetailLines.Input): keyof typeof inputSurfaceClassName =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(materials): keyof typeof inputSurfaceClassName =>
				materials.storedQuantity >= materials.required.min
					? "stored"
					: materials.deliveryQuantity > 0
						? "delivery"
						: materials.storedQuantity > 0 || materials.autofillAvailableQuantity > 0
							? "available"
							: "empty",
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit): keyof typeof inputSurfaceClassName =>
				deposit.availableCharges > 0 ? "available" : "empty",
		)
		.with(
			{
				kind: "simple",
			},
			(): keyof typeof inputSurfaceClassName => "empty",
		)
		.exhaustive();

const ItemLineInputRow = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale,
	suppressSurface,
}: {
	readonly disabled: boolean;
	readonly input: ItemDetailLines.Input;
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale: boolean;
	readonly suppressSurface: boolean;
}) => {
	const state = readItemLineInputState(input);
	const surfaceClassName = suppressSurface ? "bg-transparent" : inputSurfaceClassName[state];
	const rowClassName = `ak-line-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-sm ${surfaceClassName}`;
	return match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) => {
				const label = materials.selector.label;
				return (
					<motion.div
						layout
						className={rowClassName}
						data-ui="TileLineInput"
						data-input-kind="materials"
						data-input-state={state}
						data-surface-suppressed={suppressSurface ? "true" : "false"}
						{...itemDetailFadeMotion}
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
								<div className="flex min-h-5 items-baseline justify-end gap-2">
									<AnimatePresence initial={false}>
										{materials.storedQuantity === 0 ? null : (
											<motion.div
												key="withdraw"
												{...itemDetailBadgeMotion}
											>
												<MaterialInputWithdraw
													disabled={disabled}
													input={materials}
													lineId={lineId}
													ownerItemId={ownerItemId}
												/>
											</motion.div>
										)}
									</AnimatePresence>
									<AnimatePresence
										initial={false}
										mode="popLayout"
									>
										<motion.p
											key={
												materials.deliveryQuantity > 0
													? `delivery:${materials.deliveryQuantity}`
													: `stored:${materials.storedQuantity}`
											}
											className={`font-medium text-foreground transition-opacity duration-200 ${materials.deliveryQuantity > 0 ? "opacity-70" : ""}`}
											data-ui={
												materials.deliveryQuantity > 0
													? "TileLineInputDeliveryQuantity"
													: "TileLineInputStoredQuantity"
											}
											{...itemDetailFadeMotion}
										>
											{materials.deliveryQuantity > 0
												? materials.deliveryQuantity
												: materials.storedQuantity}{" "}
											/{" "}
											{materials.required.min === materials.required.max
												? materials.required.min
												: `${materials.required.min}–${materials.required.max}`}{" "}
											{materials.deliveryQuantity > 0
												? "on the way"
												: "stored"}
										</motion.p>
									</AnimatePresence>
								</div>
								<MaterialInputAutofillAvailability
									disabled={disabled}
									input={materials}
									label={label}
								/>
							</div>
						)}
					</motion.div>
				);
			},
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) => {
				const label = deposit.selector.label;
				return (
					<motion.div
						layout
						className={rowClassName}
						data-ui="TileLineInput"
						data-input-kind="deposit"
						data-input-state={state}
						data-surface-suppressed={suppressSurface ? "true" : "false"}
						{...itemDetailFadeMotion}
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
								<AnimatePresence
									initial={false}
									mode="popLayout"
								>
									<motion.p
										key={deposit.availableChargesLabel}
										className="font-medium text-foreground"
										{...itemDetailFadeMotion}
									>
										{deposit.availableChargesLabel === "None"
											? "None available"
											: `${deposit.availableChargesLabel} available`}
									</motion.p>
								</AnimatePresence>
							</div>
						)}
					</motion.div>
				);
			},
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => (
				<motion.div
					layout
					className={rowClassName}
					data-ui="TileLineInput"
					data-input-kind="simple"
					data-input-state={state}
					data-surface-suppressed={suppressSurface ? "true" : "false"}
					{...itemDetailFadeMotion}
				>
					<p className="font-medium text-foreground">Owner charge</p>
					<p className="text-right text-sm text-muted">
						{simple.charges.cost} charge{simple.charges.cost === 1 ? "" : "s"} from{" "}
						{simple.charges.from === "self" ? "owner" : "target"}
					</p>
				</motion.div>
			),
		)
		.exhaustive();
};

/** Renders the full authored input side of one visible product line. */
export const ItemLineInputs = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale = false,
	suppressSurface = false,
	withdraw,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLines.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale?: boolean;
	readonly suppressSurface?: boolean;
	readonly withdraw?: ItemLineInputsWithdrawAction;
}) => (
	<section className="min-w-0">
		<ItemLineInputsHeader withdraw={withdraw} />
		{input.length === 0 ? (
			<p className="py-3 text-sm text-muted">No material input required.</p>
		) : (
			<div
				className="space-y-1 pt-2"
				data-ui="TileLineInputsList"
			>
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					{input.map((entry, index) => (
						<ItemLineInputRow
							key={`${entry.kind}:${index}`}
							disabled={disabled}
							input={entry}
							lineId={lineId}
							ownerItemId={ownerItemId}
							stale={stale}
							suppressSurface={suppressSurface}
						/>
					))}
				</AnimatePresence>
			</div>
		)}
	</section>
);
