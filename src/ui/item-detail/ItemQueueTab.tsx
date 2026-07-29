import { AnimatePresence, motion } from "motion/react";

import { useClearItemDetailQueue } from "~/bridge/item-detail/useClearItemDetailQueue";
import type { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { useRemoveItemDetailQueueRequest } from "~/bridge/item-detail/useRemoveItemDetailQueueRequest";
import { Button } from "~/ui/button/Button";
import { LinkButton } from "~/ui/button/LinkButton";
import { ItemRuntime, readActiveJobRuntime } from "~/ui/item-detail/ItemRuntime";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const statusLabel = {
	"awaiting-output": "Awaiting output",
	paused: "Paused",
	running: "Running",
} as const;

const queueMotionTransition = {
	duration: 0.2,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

type QueueProjection = Extract<
	useItemDetailQueue.Projection,
	{
		readonly kind: "available";
	}
>;

const ActiveQueueSlot = ({
	job,
	queuedRequestCount,
}: {
	readonly job: QueueProjection["active"][number] | undefined;
	readonly queuedRequestCount: number;
}) => {
	const progress =
		job === undefined
			? 0
			: job.durationMs === 0
				? 1
				: Math.max(0, Math.min(1, (job.durationMs - job.remainingMs) / job.durationMs));

	return (
		<div
			className="relative min-h-28"
			data-ui="ItemQueueActiveSlot"
		>
			<AnimatePresence
				initial={false}
				mode="wait"
			>
				{job === undefined ? (
					<motion.article
						key="idle"
						className="ak-list-row absolute inset-0 grid min-h-28 content-center rounded-xl border-b border-l-2 border-line border-l-line/55 px-4 py-5"
						data-ui="ItemQueueIdleSlot"
						initial={{
							opacity: 0,
							y: 6,
						}}
						animate={{
							opacity: 1,
							y: 0,
						}}
						exit={{
							opacity: 0,
							y: -6,
						}}
						transition={queueMotionTransition}
					>
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							Nothing happening, bro.
						</h3>
						<p className="mt-2 text-sm text-muted">
							{queuedRequestCount === 0
								? "The current queue slot is idle."
								: "Queued work is waiting for this slot."}
						</p>
					</motion.article>
				) : (
					<motion.article
						key={job.jobId}
						className="ak-list-row ak-list-row-active absolute inset-0 min-h-28 overflow-hidden rounded-xl border-b border-l-2 border-line border-l-success px-4 py-5"
						data-ui="ItemQueueRow"
						data-state="active"
						initial={{
							opacity: 0,
							y: 6,
						}}
						animate={{
							opacity: 1,
							y: 0,
						}}
						exit={{
							opacity: 0,
							y: -6,
						}}
						transition={queueMotionTransition}
					>
						<div
							className="pointer-events-none absolute inset-y-0 right-0 left-0.5 overflow-hidden rounded-r-[inherit]"
							aria-hidden="true"
							data-ui="ItemQueueProgress"
						>
							<div
								className="h-full bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
								data-ui="ItemQueueProgressFill"
								style={{
									width: `${progress * 100}%`,
								}}
							/>
						</div>
						<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<h3 className="text-lg font-semibold leading-tight text-foreground">
										{job.title}
									</h3>
									<span className="rounded-full border border-success/40 bg-success/12 px-2.5 py-1 text-xs font-semibold text-foreground">
										{statusLabel[job.status]}
									</span>
								</div>
								<p className="mt-2 text-sm text-muted">Current queue slot</p>
							</div>
							<ItemRuntime
								dataUi="ItemQueueRuntime"
								jobStatus={job.status}
								runtime={readActiveJobRuntime(job)}
							/>
						</div>
					</motion.article>
				)}
			</AnimatePresence>
		</div>
	);
};

const QueueRequestRow = ({
	disabled,
	index,
	itemId,
	request,
}: {
	readonly disabled: boolean;
	readonly index: number;
	readonly itemId: QueueProjection["itemId"];
	readonly request: QueueProjection["request"][number];
}) => {
	const itemDetail = useItemDetailControl();
	const pendingKey = JSON.stringify([
		"queue-request",
		itemId,
		request.requestId,
	]);
	const removeRequest = useRemoveItemDetailQueueRequest({
		pendingKey,
		pendingOwner: itemDetail,
	});

	return (
		<article
			className="ak-list-row rounded-xl border-b border-l-2 border-line border-l-line/55 px-4 py-5"
			data-ui="ItemQueueRow"
			data-state="queued"
			data-queue-status={request.status}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							{request.title}
						</h3>
						<span className="rounded-full border border-line-strong bg-surface-raised/65 px-2.5 py-1 text-xs font-semibold text-muted">
							Queued #{index + 1}
						</span>
					</div>
					<p className="mt-2 text-sm text-muted">
						{request.status === "inputs-ready"
							? "Inputs available"
							: request.status === "waiting-inputs"
								? `Waiting for inputs · ${request.missingQuantity ?? "some"} ${
										request.missingQuantity === 1 ? "unit" : "units"
									} missing`
								: request.status === "blocked-earlier"
									? "Blocked by earlier work"
									: "Waiting for runtime conditions"}
					</p>
					{removeRequest.error === null ? null : (
						<p
							className="mt-2 text-sm text-danger"
							role="status"
						>
							{removeRequest.error}
						</p>
					)}
				</div>
				<LinkButton
					className="mt-1 shrink-0 text-sm"
					cursorIntent={removeRequest.pending ? "progress" : undefined}
					data-ui="ItemQueueDeleteButton"
					data-request-id={request.requestId}
					disabled={disabled || removeRequest.pending}
					onClick={() =>
						removeRequest.run({
							ownerItemId: itemId,
							requestId: request.requestId,
						})
					}
				>
					{removeRequest.pending ? "Deleting…" : "Delete"}
				</LinkButton>
			</div>
		</article>
	);
};

/** Renders authoritative active and queued work without treating the active job as cancellable. */
export const ItemQueueTab = ({
	disabled = false,
	queue,
}: {
	readonly disabled?: boolean;
	readonly queue: QueueProjection;
}) => {
	const itemDetail = useItemDetailControl();
	const pendingKey = JSON.stringify([
		"queue",
		queue.itemId,
	]);
	const clearQueue = useClearItemDetailQueue({
		pendingKey,
		pendingOwner: itemDetail,
	});
	const pending = clearQueue.pending;
	const error = clearQueue.error;
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
								transition={queueMotionTransition}
							>
								<Button
									type="button"
									data-ui="ItemQueueClearButton"
									disabled={disabled || pending}
									cursorIntent={pending ? "progress" : undefined}
									onClick={() =>
										clearQueue.run({
											ownerItemId: queue.itemId,
										})
									}
								>
									{pending ? "Clearing…" : "Clear queue"}
								</Button>
							</motion.div>
						)}
					</AnimatePresence>
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
			<Scrollable className="flex-1 pr-1">
				<div
					className="ak-list grid gap-1"
					data-ui="ItemQueueList"
				>
					<ActiveQueueSlot
						job={queue.active[0]}
						queuedRequestCount={queue.request.length}
					/>
					<AnimatePresence
						initial={false}
						mode="sync"
					>
						{queue.request.map((request, index) => (
							<motion.div
								key={request.requestId}
								className="overflow-hidden"
								layout
								initial={{
									height: 0,
									opacity: 0,
									y: 6,
								}}
								animate={{
									height: "auto",
									opacity: 1,
									y: 0,
								}}
								exit={{
									height: 0,
									opacity: 0,
									y: -6,
								}}
								transition={queueMotionTransition}
							>
								<QueueRequestRow
									disabled={disabled}
									index={index}
									itemId={queue.itemId}
									request={request}
								/>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</Scrollable>
		</div>
	);
};
