import { AnimatePresence, motion } from "motion/react";
import { forwardRef } from "react";

import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineCommandPanel } from "~/item-line-detail/ui/ItemLineCommandPanel";
import { ItemLineDetails } from "~/item-line-detail/ui/ItemLineDetails";
import { ItemLineStatus } from "~/item-line-detail/ui/ItemLineStatus";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { useItemLineCommandController } from "~/item-line-detail/ui/useItemLineCommandController";
import { ProductionJobProgress } from "~/production-job/ui/ProductionJobProgress";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface ItemLineRowProps extends useItemLineCommandController.Props {
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly line: ItemDetailLinesProjection.Line;
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
	readonly stale?: boolean;
}

/** Composes one live product line from status, commands, runtime, inputs, and outputs. */
export const ItemLineRow = forwardRef<HTMLElement, ItemLineRowProps>(function ItemLineRow(
	{ definitionItemId, disabled, line, ownerItemId, renderIdentity, stale = false },
	ref,
) {
	const commands = useItemLineCommandController({
		line,
		ownerItemId,
	});
	const queued = !stale && line.activeJob === undefined && line.queuedRequestCount > 0;
	const lineState = stale
		? "stale"
		: line.activeJob !== undefined
			? "active"
			: queued
				? "queued"
				: "idle";

	return (
		<motion.article
			ref={ref}
			layout
			className="ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line border-l-line/55 px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5 data-[ui-state=active]:border-l-success data-[ui-state=queued]:border-l-warning data-[ui-state=queued]:bg-warning/[0.06]"
			data-line-id={line.lineId}
			{...readDataUiFn({
				dataUi: "TileLine",
				state: {
					state: lineState,
				},
			})}
			{...itemDetailFadeMotion}
		>
			<AnimatePresence initial={false}>
				{stale || line.activeJob === undefined ? null : (
					<motion.div
						key="progress"
						animate={{
							opacity: 1,
						}}
						className="pointer-events-none absolute inset-y-0 right-0 left-0.5"
						exit={{
							opacity: 0,
						}}
						initial={{
							opacity: 0,
						}}
						transition={itemDetailFadeMotion.transition}
					>
						<ProductionJobProgress runtime={line.activeJob} />
					</motion.div>
				)}
			</AnimatePresence>
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
				<ItemLineStatus
					definitionItemId={definitionItemId}
					disabled={disabled}
					line={line}
					queued={queued}
					renderIdentity={renderIdentity}
					stale={stale}
				/>
				{stale ? null : (
					<ItemLineCommandPanel
						disabled={disabled}
						enqueueFn={commands.enqueueFn}
						line={line}
						pendingDefault={commands.pending.default}
						pendingEnqueue={commands.pending.enqueue}
						setDefaultFn={commands.setDefaultFn}
						unsetDefaultFn={commands.unsetDefaultFn}
					/>
				)}
			</div>
			<AnimatePresence initial={false}>
				{stale || commands.error === null ? null : (
					<motion.p
						key={commands.error}
						className="relative z-[1] mt-3 text-sm text-danger"
						{...itemDetailFadeMotion}
					>
						{commands.error}
					</motion.p>
				)}
			</AnimatePresence>
			<ItemLineDetails
				disabled={disabled}
				line={line}
				ownerItemId={ownerItemId}
				pendingWithdraw={commands.pending.withdraw}
				requestWithdrawFn={commands.withdrawFn}
				stale={stale}
			/>
		</motion.article>
	);
});
