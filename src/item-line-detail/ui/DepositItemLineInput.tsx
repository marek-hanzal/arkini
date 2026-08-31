import { AnimatePresence, motion } from "motion/react";

import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInputFrame, ItemLineInputTitle } from "~/item-line-detail/ui/ItemLineInputFrame";

type DepositInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "deposit";
	}
>;

/** Owns board-deposit availability and charge presentation. */
export const DepositItemLineInput = ({
	disabled,
	input,
	stale,
	suppressSurface,
}: {
	readonly disabled: boolean;
	readonly input: DepositInput;
	readonly stale: boolean;
	readonly suppressSurface: boolean;
}) => (
	<ItemLineInputFrame
		inputKind="deposit"
		state={input.availableCharges > 0 ? "available" : "empty"}
		suppressSurface={suppressSurface}
	>
		<div className="min-w-0">
			<ItemLineInputTitle
				detail={input.detail}
				disabled={disabled}
				label={input.selector.label}
			/>
			<p className="mt-0.5 text-xs text-muted">
				Board · {input.distance}
				{input.charges === undefined
					? ""
					: ` · ${input.charges.cost} charge${input.charges.cost === 1 ? "" : "s"} from ${input.charges.from === "self" ? "owner" : "target"}`}
			</p>
		</div>
		{stale ? null : (
			<div className="text-right">
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					<motion.p
						key={input.availableChargesLabel}
						className="font-medium text-foreground"
						{...itemDetailFadeMotion}
					>
						{input.availableChargesLabel === "None"
							? "None available"
							: `${input.availableChargesLabel} available`}
					</motion.p>
				</AnimatePresence>
			</div>
		)}
	</ItemLineInputFrame>
);
