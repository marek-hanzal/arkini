import { AnimatePresence, motion } from "motion/react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import {
	itemDetailBadgeMotion,
	itemDetailFadeMotion,
} from "~/item-detail-frame/ui/ItemDetailMotion";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import {
	ItemLineInputFrame,
	ItemLineInputTitle,
	type ItemLineInputState,
} from "~/item-line-detail/ui/ItemLineInputFrame";
import { MaterialInputWithdraw } from "~/item-line-detail/ui/ItemLineInputWithdrawal";
import { LinkButton } from "~/ui/button/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type MaterialInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "materials";
	}
>;

const readMaterialInputStateFn = (input: MaterialInput): ItemLineInputState =>
	input.storedQuantity >= input.required.min
		? "stored"
		: input.deliveryQuantity > 0
			? "delivery"
			: input.storedQuantity > 0 || input.autofillAvailableQuantity > 0
				? "available"
				: "empty";

const MaterialInputAutofillAvailability = ({
	disabled,
	input,
	label,
}: {
	readonly disabled: boolean;
	readonly input: MaterialInput;
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

/** Owns material storage, delivery, withdrawal, and producer-link presentation. */
export const MaterialItemLineInput = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale,
	suppressSurface,
}: {
	readonly disabled: boolean;
	readonly input: MaterialInput;
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale: boolean;
	readonly suppressSurface: boolean;
}) => {
	const label = input.selector.label;
	const delivery = input.deliveryQuantity > 0;

	return (
		<ItemLineInputFrame
			inputKind="materials"
			state={readMaterialInputStateFn(input)}
			suppressSurface={suppressSurface}
		>
			<div className="min-w-0">
				<ItemLineInputTitle
					detail={input.detail}
					disabled={disabled}
					label={label}
				/>
				<p className="mt-0.5 text-xs text-muted">
					{input.mode === "consume" ? "Consumed" : "Reserved"}
					{input.charges === undefined
						? ""
						: ` · ${input.charges.cost} charge${input.charges.cost === 1 ? "" : "s"} from ${input.charges.from === "self" ? "owner" : "target"}`}
				</p>
			</div>
			{stale ? null : (
				<div className="flex flex-col items-end text-right">
					<div className="flex min-h-5 items-baseline justify-end gap-2">
						<AnimatePresence initial={false}>
							{input.storedQuantity === 0 ? null : (
								<motion.div
									key="withdraw"
									{...itemDetailBadgeMotion}
								>
									<MaterialInputWithdraw
										disabled={disabled}
										input={input}
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
									delivery
										? `delivery:${input.deliveryQuantity}`
										: `stored:${input.storedQuantity}`
								}
								className="ak-line-input-quantity font-medium text-foreground transition-opacity duration-200"
								{...readDataUiFn({
									dataUi: delivery
										? "TileLineInputDeliveryQuantity"
										: "TileLineInputStoredQuantity",
									state: {
										delivery,
									},
								})}
								{...itemDetailFadeMotion}
							>
								{delivery ? input.deliveryQuantity : input.storedQuantity} /{" "}
								{input.required.min === input.required.max
									? input.required.min
									: `${input.required.min}–${input.required.max}`}{" "}
								{delivery ? "on the way" : "stored"}
							</motion.p>
						</AnimatePresence>
					</div>
					<MaterialInputAutofillAvailability
						disabled={disabled}
						input={input}
						label={label}
					/>
				</div>
			)}
		</ItemLineInputFrame>
	);
};
