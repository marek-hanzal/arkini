import { useClearItemDetailQueue } from "~/bridge/item-detail/useClearItemDetailQueue";
import type { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { Button } from "~/ui/button/Button";
import { ItemRuntime, readActiveJobRuntime } from "~/ui/item-detail/ItemRuntime";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const statusLabel = {
	"awaiting-output": "Awaiting output",
	paused: "Paused",
	running: "Running",
} as const;

/** Renders authoritative active and queued work without treating the active job as cancellable. */
export const ItemQueueTab = ({
	disabled = false,
	queue,
}: {
	readonly disabled?: boolean;
	readonly queue: Extract<
		useItemDetailQueue.Projection,
		{
			readonly kind: "available";
		}
	>;
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
	const empty = used === 0;

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemQueueTab"
		>
			<div className="flex items-center justify-between gap-4 border-b border-line pb-3 text-sm">
				<p className="text-muted">
					{used} / {queue.capacity} queue slots used
				</p>
				<Button
					type="button"
					disabled={disabled || queue.request.length === 0}
					cursorIntent={pending ? "progress" : undefined}
					onClick={() =>
						clearQueue.run({
							ownerItemId: queue.itemId,
						})
					}
				>
					{pending ? "Clearing…" : "Clear queue"}
				</Button>
			</div>
			{error === null ? null : (
				<p
					className="mt-3 text-sm text-danger"
					role="status"
				>
					{error}
				</p>
			)}
			{empty ? (
				<div className="grid flex-1 place-items-center py-12 text-muted">
					No active or queued work.
				</div>
			) : (
				<Scrollable className="flex-1 pr-1">
					<div
						className="ak-list grid gap-1"
						data-ui="ItemQueueList"
					>
						{queue.active.map((job) => {
							const progress =
								job.durationMs === 0
									? 1
									: Math.max(
											0,
											Math.min(
												1,
												(job.durationMs - job.remainingMs) / job.durationMs,
											),
										);
							return (
								<article
									key={job.jobId}
									className="ak-list-row ak-list-row-active overflow-hidden rounded-xl border-b border-l-2 border-line border-l-success px-4 py-5"
									data-ui="ItemQueueRow"
									data-state="active"
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
											<p className="mt-2 text-sm text-muted">
												Current queue slot
											</p>
										</div>
										<ItemRuntime
											dataUi="ItemQueueRuntime"
											jobStatus={job.status}
											runtime={readActiveJobRuntime(job)}
										/>
									</div>
								</article>
							);
						})}
						{queue.request.map((request, index) => (
							<article
								key={request.requestId}
								className="ak-list-row rounded-xl border-b border-l-2 border-line border-l-line/55 px-4 py-5"
								data-ui="ItemQueueRow"
								data-state="queued"
								data-queue-status={request.status}
							>
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
							</article>
						))}
					</div>
				</Scrollable>
			)}
		</div>
	);
};
