import { CircleOff, ListX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { clearItemJobQueueFx } from "~/production-job/write/clearItemJobQueueFx";
import type { useItemDetailQueue } from "~/ui/item-detail/useItemDetailQueue";
import { LinkButton } from "~/ui/button/LinkButton";
import { ItemIdentity } from "~/ui/item/ItemIdentity";
import {
	itemDetailBadgeMotion,
	itemDetailFadeMotion,
	itemDetailMotionTransition,
} from "~/item-detail-frame/ItemDetailMotion";
import { ProductionJobRuntime } from "~/production-job/ui/ProductionJobRuntime";
import { readActiveJobRuntimeFn } from "~/production-job/ui/readActiveJobRuntimeFn";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/item-detail-frame/useItemDetailControl";
import { useItemDetailPendingCommand } from "~/item-detail-frame/useItemDetailPendingCommand";

const statusLabel = {
	"awaiting-output": "Awaiting output",
	paused: "Paused",
	running: "Running",
} as const;

type QueueProjection = Extract<
	useItemDetailQueue.Projection,
	{
		readonly kind: "available";
	}
>;

const QueueWorkIdentity = ({
	identity,
	title,
}: {
	readonly identity?: QueueProjection["active"][number]["identity"];
	readonly title: string;
}) =>
	identity === undefined ? (
		<h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>
	) : (
		<ItemIdentity
			artworkClassName="rounded-lg bg-surface/45 ring-1 ring-line/50"
			artworkImageClassName="p-0.5"
			compositeUrl={identity.compositeUrl}
			dataUi="ItemQueueWorkIdentity"
			size="md"
			sourceUrl={identity.sourceUrl}
			title={title}
			titleClassName="truncate text-lg font-semibold leading-tight text-foreground"
			titleTag="h3"
		/>
	);

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
						transition={itemDetailMotionTransition}
					>
						<h3 className="flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
							<CircleOff
								className="size-5 shrink-0 text-muted"
								aria-hidden="true"
							/>
							No active job
						</h3>
						<AnimatePresence
							initial={false}
							mode="popLayout"
						>
							<motion.p
								key={queuedRequestCount === 0 ? "empty" : "queued"}
								className="mt-2 text-sm text-muted"
								{...itemDetailFadeMotion}
							>
								{queuedRequestCount === 0
									? "Nothing is currently scheduled to run."
									: "Queued work will start as soon as its requirements are met."}
							</motion.p>
						</AnimatePresence>
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
						transition={itemDetailMotionTransition}
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
									<QueueWorkIdentity
										identity={job.identity}
										title={job.title}
									/>
									<AnimatePresence
										initial={false}
										mode="popLayout"
									>
										{job.status === "running" ? null : (
											<motion.span
												key={job.status}
												className="rounded-full border border-success/40 bg-success/12 px-2.5 py-1 text-xs font-semibold text-foreground"
												{...itemDetailBadgeMotion}
											>
												{statusLabel[job.status]}
											</motion.span>
										)}
									</AnimatePresence>
								</div>
							</div>
							<ProductionJobRuntime
								dataUi="ItemQueueRuntime"
								jobStatus={job.status}
								runtime={readActiveJobRuntimeFn(job)}
							/>
						</div>
					</motion.article>
				)}
			</AnimatePresence>
		</div>
	);
};

const QueueRequestRow = ({
	index,
	request,
}: {
	readonly index: number;
	readonly request: QueueProjection["request"][number];
}) => (
	<article
		className="ak-list-row rounded-xl border-b border-l-2 border-line border-l-line/55 px-4 py-5"
		data-ui="ItemQueueRow"
		data-state="queued"
		data-queue-status={request.status}
	>
		<div className="min-w-0">
			<div className="flex flex-wrap items-center gap-2">
				<QueueWorkIdentity
					identity={request.identity}
					title={request.title}
				/>
				<span className="rounded-full border border-line-strong bg-surface-raised/65 px-2.5 py-1 text-xs font-semibold text-muted">
					Queued #{index + 1}
				</span>
			</div>
			<AnimatePresence
				initial={false}
				mode="popLayout"
			>
				<motion.p
					key={`${request.status}:${request.missingQuantity ?? "unknown"}`}
					className="mt-2 text-sm text-muted"
					{...itemDetailFadeMotion}
				>
					{request.status === "inputs-ready"
						? "Inputs available"
						: request.status === "waiting-inputs"
							? `Waiting for inputs · ${request.missingQuantity ?? "some"} ${
									request.missingQuantity === 1 ? "unit" : "units"
								} missing`
							: request.status === "blocked-earlier"
								? "Blocked by earlier work"
								: "Waiting for runtime conditions"}
				</motion.p>
			</AnimatePresence>
		</div>
	</article>
);

/** Renders read-only work status with one explicit whole-owner pending queue clear. */
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
	const clearQueue = useItemDetailPendingCommand({
		action: "clear-queue",
		failureMessage: "Queue could not be cleared.",
		pendingKey,
		pendingOwner: itemDetail,
		run: (game, command: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(command)),
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
								transition={itemDetailMotionTransition}
							>
								<LinkButton
									className="text-sm"
									data-ui="ItemQueueClearButton"
									disabled={disabled || pending}
									cursorIntent={pending ? "progress" : undefined}
									onClick={() =>
										clearQueue.run({
											ownerItemId: queue.itemId,
										})
									}
								>
									Clear queue
								</LinkButton>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
			<AnimatePresence initial={false}>
				{error === null ? null : (
					<motion.p
						key={error}
						className="mt-3 text-sm text-danger"
						role="status"
						{...itemDetailFadeMotion}
					>
						{error}
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
						<ActiveQueueSlot
							job={queue.active[0]}
							queuedRequestCount={queue.request.length}
						/>
					</div>
					<AnimatePresence
						initial={false}
						mode="sync"
					>
						{queue.request.length === 0 ? (
							<motion.div
								key="empty-queue"
								className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted"
								data-ui="ItemQueueEmptyState"
								{...itemDetailFadeMotion}
							>
								<div className="grid justify-items-center gap-2">
									<ListX
										className="size-6 text-subtle"
										aria-hidden="true"
									/>
									<p>Queue is empty</p>
								</div>
							</motion.div>
						) : (
							queue.request.map((request, index) => (
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
									transition={itemDetailMotionTransition}
								>
									<QueueRequestRow
										index={index}
										request={request}
									/>
								</motion.div>
							))
						)}
					</AnimatePresence>
				</div>
			</Scrollable>
		</div>
	);
};
