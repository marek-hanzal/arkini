import { CircleOff, ListX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
	itemDetailBadgeMotion,
	itemDetailFadeMotion,
	itemDetailMotionTransition,
} from "~/item-detail-frame/ui/ItemDetailMotion";
import type { useRuntimeItemDetailSceneController } from "~/item-detail/ui/useRuntimeItemDetailSceneController";
import { ProductionJobRuntime } from "~/production-job/ui/ProductionJobRuntime";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemIdentity } from "~/ui/ui/ItemIdentity";

type QueueProjection = Extract<
	useRuntimeItemDetailSceneController.QueueProjection,
	{
		readonly kind: "available";
	}
>;

const statusLabel = {
	"awaiting-output": "Awaiting output",
	paused: "Paused",
	running: "Running",
} as const;

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

/** Renders the only currently active queue slot and its live runtime. */
export const ItemQueueActiveSlot = ({
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
							<CircleOff className="size-5 shrink-0 text-muted" />
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
						className="ak-list-row absolute inset-0 min-h-28 overflow-hidden rounded-xl border-b border-l-2 border-line border-l-success px-4 py-5"
						{...readDataUiFn({
							dataUi: "ItemQueueRow",
							state: {
								state: "active",
							},
						})}
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
								runtime={job}
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
		{...readDataUiFn({
			dataUi: "ItemQueueRow",
			state: {
				queueStatus: request.status,
				state: "queued",
			},
		})}
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

/** Renders queued requests or the canonical empty queue presentation. */
export const ItemQueueRequestList = ({
	request,
}: {
	readonly request: QueueProjection["request"];
}) => (
	<AnimatePresence
		initial={false}
		mode="sync"
	>
		{request.length === 0 ? (
			<motion.div
				key="empty-queue"
				className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted"
				data-ui="ItemQueueEmptyState"
				{...itemDetailFadeMotion}
			>
				<div className="grid justify-items-center gap-2">
					<ListX className="size-6 text-subtle" />
					<p>Queue is empty</p>
				</div>
			</motion.div>
		) : (
			request.map((entry, index) => (
				<motion.div
					key={entry.requestId}
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
						request={entry}
					/>
				</motion.div>
			))
		)}
	</AnimatePresence>
);
