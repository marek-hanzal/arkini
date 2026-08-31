import { AnimatePresence, motion } from "motion/react";

import {
	itemDetailFadeMotion,
	itemDetailMotionTransition,
} from "~/item-detail-frame/ui/ItemDetailMotion";
import { ItemQueueActiveSlot, ItemQueueRequestList } from "~/item-detail/ui/ItemQueueWork";
import type { useRuntimeItemDetailSceneController } from "~/item-detail/ui/useRuntimeItemDetailSceneController";
import { useItemQueueClearController } from "~/item-detail/ui/useItemQueueClearController";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Scrollable } from "~/ui/ui/Scrollable";

type QueueProjection = Extract<
	useRuntimeItemDetailSceneController.QueueProjection,
	{
		readonly kind: "available";
	}
>;

interface ItemQueueTabProps extends useItemQueueClearController.Props {
	readonly disabled?: boolean;
	readonly queue: QueueProjection;
}

/** Composes queue commands, the active slot, and queued request presentation. */
export const ItemQueueTab = ({ disabled = false, queue }: ItemQueueTabProps) => {
	const controller = useItemQueueClearController({
		queue,
	});
	const used = queue.active.length + queue.request.length;

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemQueueTab"
		>
			<div className="flex items-center justify-between gap-4 border-b border-line pb-3 text-sm">
				<p className="text-muted">
					{used} / {queue.capacity} queue slots used
				</p>
				<div className="flex min-h-10 items-center justify-end">
					<AnimatePresence initial={false}>
						{queue.request.length === 0 ? null : (
							<motion.div
								key="clear-queue"
								initial={{
									opacity: 0,
									scale: 0.96,
								}}
								animate={{
									opacity: 1,
									scale: 1,
								}}
								exit={{
									opacity: 0,
									scale: 0.96,
								}}
								transition={itemDetailMotionTransition}
							>
								<LinkButton
									className="text-sm"
									data-ui="ItemQueueClearButton"
									disabled={disabled || controller.pending}
									cursorIntent={controller.pending ? "progress" : undefined}
									onClick={controller.clearQueue}
								>
									Clear queue
								</LinkButton>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
			<AnimatePresence initial={false}>
				{controller.error === null ? null : (
					<motion.p
						key={controller.error}
						className="mt-3 text-sm text-danger"
						{...itemDetailFadeMotion}
					>
						{controller.error}
					</motion.p>
				)}
			</AnimatePresence>
			<Scrollable className="flex-1 pr-1">
				<div
					className="ak-list grid gap-1"
					data-ui="ItemQueueList"
				>
					<div
						className="mb-2 border-b border-line pb-3"
						data-ui="ItemQueueActiveSlotSeparator"
					>
						<ItemQueueActiveSlot
							job={queue.active[0]}
							queuedRequestCount={queue.request.length}
						/>
					</div>
					<ItemQueueRequestList request={queue.request} />
				</div>
			</Scrollable>
		</div>
	);
};
