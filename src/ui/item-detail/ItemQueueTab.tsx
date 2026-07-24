import { useClearItemDetailQueue } from "~/bridge/item-detail/useClearItemDetailQueue";
import type { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { Button } from "~/ui/button/Button";
import { Scrollable } from "~/ui/scrollable/Scrollable";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/** Renders authoritative queued intents without treating active work as cancellable. */
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
	const clearQueue = useClearItemDetailQueue();
	const pendingKey = JSON.stringify([
		"queue",
		queue.itemId,
	]);
	const pending = itemDetail.readPendingAction(pendingKey) === "clear-queue";
	const error = itemDetail.readActionError(pendingKey);
	const used = queue.activeCount + queue.request.length;

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
					disabled={disabled || queue.request.length === 0 || pending}
					cursorIntent={pending ? "progress" : undefined}
					onClick={() => {
						void itemDetail.runPendingAction({
							key: pendingKey,
							action: "clear-queue",
							failureMessage: "Queue could not be cleared.",
							run: () =>
								clearQueue({
									ownerItemId: queue.itemId,
								}),
						});
					}}
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
			{queue.request.length === 0 ? (
				<div className="grid flex-1 place-items-center py-12 text-muted">
					Queue is empty.
				</div>
			) : (
				<Scrollable className="flex-1">
					{queue.request.map((request, index) => (
						<div
							key={request.requestId}
							className="flex items-center gap-4 border-b border-line py-3 last:border-b-0"
							data-ui="ItemQueueRow"
						>
							<span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted">
								{index + 1}
							</span>
							<div className="min-w-0">
								<p className="truncate font-medium">{request.title}</p>
								<p className="truncate text-xs text-muted">Queued intent</p>
							</div>
						</div>
					))}
				</Scrollable>
			)}
		</div>
	);
};
