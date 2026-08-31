import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import { ItemReferenceButton } from "~/item-detail-frame/ui/ItemReferenceButton";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInputs } from "~/item-line-detail/ui/ItemLineInputs";
import { ItemLineUnavailableWithdrawals } from "~/item-line-detail/ui/ItemLineInputWithdrawal";
import { Outputs } from "~/production-output/ui/Outputs";

/** Renders the input-to-output body and buffered-input recovery for one line. */
export const ItemLineDetails = ({
	disabled,
	line,
	ownerItemId,
	pendingWithdraw,
	requestWithdraw,
	stale,
}: {
	readonly disabled: boolean;
	readonly line: ItemDetailLinesProjection.Line;
	readonly ownerItemId: string;
	readonly pendingWithdraw: boolean;
	readonly requestWithdraw: () => void;
	readonly stale: boolean;
}) => {
	const unavailable = line.availability.kind === "unavailable";
	const contentReadOnly = disabled || line.activeJob !== undefined;
	const withdrawAction =
		!stale &&
		line.actions.canWithdraw &&
		line.input.some(
			(candidate) => candidate.kind === "materials" && candidate.storedQuantity > 0,
		)
			? {
					disabled: contentReadOnly,
					onClick: requestWithdraw,
					pending: pendingWithdraw,
				}
			: undefined;

	return (
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
						withdraw={withdrawAction}
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
						withdraw={withdrawAction}
					/>
					<div
						className="grid place-items-center text-muted"
						data-ui="TileLineFlowChevron"
					>
						<ChevronRight className="size-5" />
					</div>
					<Outputs
						output={line.output}
						renderItem={(item) =>
							item.sourceUrl === undefined ? (
								<span className="truncate font-medium text-foreground">
									{item.title}
								</span>
							) : (
								<ItemReferenceButton
									compositeUrl={item.compositeUrl}
									dataUi="TileLineOutputDetailLink"
									definitionItemId={item.definitionItemId}
									disabled={contentReadOnly}
									label={item.title}
									sourceUrl={item.sourceUrl}
								/>
							)
						}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
