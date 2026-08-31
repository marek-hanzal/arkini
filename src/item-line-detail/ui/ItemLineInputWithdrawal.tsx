import { AnimatePresence, motion } from "motion/react";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { useItemLineInputWithdrawalController } from "~/item-line-detail/ui/useItemLineInputWithdrawalController";
import { itemDetailBadgeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import { LinkButton } from "~/ui/ui/LinkButton";

export interface ItemLineInputsWithdrawAction {
	readonly disabled: boolean;
	readonly onClickFn: () => void;
	readonly pending: boolean;
}

export const ItemLineInputsHeader = ({
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
						onClick={withdraw.onClickFn}
					>
						Withdraw
					</LinkButton>
				</motion.div>
			)}
		</AnimatePresence>
	</div>
);

type MaterialInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "materials";
	}
>;

interface MaterialInputWithdrawProps extends useItemLineInputWithdrawalController.Props {
	readonly disabled: boolean;
	readonly input: MaterialInput;
}

/** Binds one exact buffered-input withdrawal command to its presentation. */
export const MaterialInputWithdraw = ({
	disabled,
	input,
	lineId,
	ownerItemId,
}: MaterialInputWithdrawProps) => {
	const controller = useItemLineInputWithdrawalController({
		input,
		lineId,
		ownerItemId,
	});

	return (
		<div className="flex flex-col items-end">
			<LinkButton
				className="text-xs"
				cursorIntent={controller.pending ? "progress" : undefined}
				data-ui="TileLineInputWithdrawButton"
				disabled={disabled || controller.pending || !input.canWithdraw}
				onClick={controller.withdrawFn}
			>
				Withdraw
			</LinkButton>
			{controller.error === null ? null : (
				<p className="mt-1 text-xs text-danger">{controller.error}</p>
			)}
		</div>
	);
};

interface ItemLineUnavailableWithdrawalsProps {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLinesProjection.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly withdraw?: ItemLineInputsWithdrawAction;
}

/** Keeps exact buffered-input recovery available when the line body is unavailable. */
export const ItemLineUnavailableWithdrawals = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	withdraw,
}: ItemLineUnavailableWithdrawalsProps) => {
	const buffered = input.filter(
		(candidate): candidate is MaterialInput =>
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
