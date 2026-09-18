import { Equal, Exit } from "effect";
import { Factory, ListOrdered, ListX, Pause, X } from "lucide-react";
import { useCallback } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemLineCancelController } from "~/item-detail/ui/useItemLineCancelController";
import { useItemQueueClearController } from "~/item-detail/ui/useItemQueueClearController";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";

interface ItemQueueProps extends useItemQueueClearController.Props {
	readonly queueSize?: number;
}

const QueuedLine = ({
	ownerItemId,
	line,
	requestId,
	position,
	disabled,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly line: LineSchema.Type;
	readonly requestId: IdSchema.Type;
	readonly position: number;
	readonly disabled: boolean;
}) => {
	const translator = useTranslator();
	const cancel = useItemLineCancelController({
		ownerItemId,
		lineId: line.id,
		requestId,
		disabled,
	});
	return (
		<li
			className="flex gap-4 py-4"
			data-ui="ItemQueueRequest"
			data-request-id={requestId}
		>
			<span className="w-6 shrink-0 text-lg tabular-nums text-muted">{position}</span>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold">{line.title}</h3>
					<span className="text-muted">· {formatDurationFn(line.runtimeMs)}</span>
					<LinkButton
						className="ml-auto inline-flex shrink-0 items-center gap-2 text-sm"
						disabled={cancel.disabled}
						onClick={cancel.cancelFn}
					>
						<X className="size-4" />
						{translator.textFn("Cancel")}
					</LinkButton>
				</div>
				<ItemLineInputs
					ownerItemId={ownerItemId}
					line={line}
					idle={false}
					disabled={disabled}
					work={{
						kind: "queued",
						id: requestId,
					}}
				/>
			</div>
		</li>
	);
};

/** Keeps active work in a fixed slot and lists accepted requests in canonical queue order. */
export const ItemQueue = ({ ownerItemId, queueSize, disabled }: ItemQueueProps) => {
	const translator = useTranslator();
	const game = useGameEngine();
	const clear = useItemQueueClearController({
		ownerItemId,
		disabled,
	});
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined)
				return {
					queue: {
						kind: "unavailable",
					} as const,
					lines: [],
				};
			const result = game.readFn(
				readItemDetailQueueFx({
					itemId: owner.id,
					runtime,
				}),
			);
			if (Exit.isFailure(result)) throw result.cause;
			return {
				queue: result.value,
				lines: owner.item.lines,
			};
		},
		[
			game,
			ownerItemId,
		],
	);
	const { queue, lines } = useRuntimeSelector(game, selectorFn, Equal.equals);
	const active = queue.kind === "available" ? queue.active[0] : undefined;
	const requests = queue.kind === "available" ? queue.request : [];
	const activeLine = lines.find((line) => line.id === active?.lineId);
	if (queueSize === undefined)
		return (
			<Status
				icon={Factory}
				title={translator.textFn("This item has nothing to make.")}
				size="large"
				variant="flat"
			/>
		);
	return (
		<section
			className="flex h-full min-h-0 flex-col px-3"
			data-ui="ItemQueue"
		>
			<header className="flex shrink-0 items-center gap-6 py-4 text-sm">
				<span className="text-muted">
					{translator.textFn("Queue size")}:{" "}
					<strong className="text-foreground">{queueSize}</strong>
				</span>
				{requests.length > 0 ? (
					<>
						<span className="text-muted">
							{translator.textFn("Queued items")}:{" "}
							<strong className="text-foreground">{requests.length}</strong>
						</span>
						<LinkButton
							className="ml-auto inline-flex items-center gap-2"
							disabled={clear.disabled}
							onClick={clear.clearFn}
						>
							<ListX className="size-4" />
							{translator.textFn("Clear queue")}
						</LinkButton>
					</>
				) : null}
			</header>
			<section
				className="flex h-52 shrink-0 flex-col border-y border-line py-4"
				data-ui="ItemQueueActive"
			>
				<h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
					{translator.textFn("Current production")}
				</h2>
				{active !== undefined && activeLine !== undefined ? (
					<div className="min-h-0 overflow-auto">
						<div className="flex items-center gap-3">
							<h3 className="text-lg font-semibold">{active.title}</h3>
							<span className="ml-auto text-sm">
								{match(active.status)
									.with("running", () => translator.textFn("Running"))
									.with("paused", () => translator.textFn("Paused"))
									.with("awaiting-output", () =>
										translator.textFn("Waiting for space"),
									)
									.exhaustive()}
								{active.status === "running" ? (
									<span className="inline-block min-w-[6ch] text-right tabular-nums">
										· {(Math.max(0, active.remainingMs) / 1000).toFixed(1)} s
									</span>
								) : null}
							</span>
						</div>
						<ItemLineInputs
							ownerItemId={ownerItemId}
							line={activeLine}
							idle={false}
							disabled={disabled}
							work={{
								kind: "active",
								id: active.jobId,
							}}
						/>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center gap-2 text-muted">
						<Pause className="size-5" />
						{translator.textFn("Nothing is being made right now.")}
					</div>
				)}
			</section>
			<div
				className="min-h-0 flex-1 overflow-auto"
				data-ui="ItemQueuePending"
			>
				{requests.length === 0 ? (
					<Status
						icon={ListOrdered}
						title={translator.textFn("Your queue is empty.")}
						description={translator.textFn("Choose something to make in Lines.")}
						variant="flat"
					/>
				) : (
					<ol className="divide-y divide-line">
						{requests.map((request, index) => {
							const line = lines.find((candidate) => candidate.id === request.lineId);
							return line === undefined ? null : (
								<QueuedLine
									key={request.requestId}
									ownerItemId={ownerItemId}
									line={line}
									requestId={request.requestId}
									position={index + 1}
									disabled={disabled}
								/>
							);
						})}
					</ol>
				)}
			</div>
		</section>
	);
};
