import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { Equal, Exit } from "effect";
import { Factory, Inbox, ListOrdered, ListX, X } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { ItemJobCancel } from "~/item-detail/ui/ItemJobCancel";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { ItemLineBackdrop } from "~/item-detail/ui/ItemLineBackdrop";
import { ItemProductionRow } from "~/item-detail/ui/ItemProductionRow";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { useItemLineCancelController } from "~/item-detail/ui/useItemLineCancelController";
import { useItemQueueClearController } from "~/item-detail/ui/useItemQueueClearController";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";

const queueFadeMotion = {
	initial: {
		opacity: 0,
	},
	animate: {
		opacity: 1,
	},
	exit: {
		opacity: 0,
	},
	transition: {
		duration: 0.2,
		ease: "easeInOut" as const,
	},
};

/** Outgoing content stays visible only for its fade, never as an actionable stale job. */
const ItemQueuePresence = ({ children }: { readonly children: ReactNode }) => {
	const present = useIsPresent();
	return (
		<motion.div
			{...queueFadeMotion}
			className="flex h-full flex-1 shrink-0 flex-col"
			data-ui="ItemQueuePresence"
			inert={!present}
		>
			{children}
		</motion.div>
	);
};

interface ItemQueueProps extends useItemQueueClearController.Props {
	readonly queueSize?: number;
}

const QueuedLine = ({
	ownerItemId,
	line,
	requestId,
	disabled,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly line: LineSchema.Type;
	readonly requestId: IdSchema.Type;
	readonly disabled: boolean;
}) => {
	const translator = useTranslator();
	const game = useGameEngine();
	const present = useIsPresent();
	const cancel = useItemLineCancelController({
		ownerItemId,
		lineId: line.id,
		requestId,
		disabled,
	});
	return (
		<motion.li
			initial={{
				opacity: 0,
				height: 0,
			}}
			animate={{
				opacity: 1,
				height: "auto",
			}}
			exit={{
				opacity: 0,
				height: 0,
			}}
			transition={{
				duration: 0.25,
				ease: "easeInOut",
			}}
			className="overflow-hidden"
			inert={!present}
			data-ui="ItemQueueRequest"
			data-request-id={requestId}
		>
			<ItemProductionRow
				line={line}
				backdrop={
					line.artwork === undefined ? null : (
						<ItemLineBackdrop sourceUrl={game.getResourceUrlFn(line.artwork)} />
					)
				}
				actions={
					<LinkButton
						className="inline-flex shrink-0 items-center gap-2 text-sm"
						disabled={cancel.disabled}
						onClick={cancel.cancelFn}
					>
						<X className="size-4" />
						{translator.textFn("Cancel")}
					</LinkButton>
				}
				inputs={
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
				}
			/>
		</motion.li>
	);
};

/** Reserves current production above accepted requests in canonical queue order. */
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
	const occupied = requests.length + (queue.kind === "available" ? queue.active.length : 0);
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
	const capacity = queue.kind === "available" ? queue.capacity : queueSize;
	return (
		<section
			className="flex h-full min-h-0 flex-col pl-3"
			data-ui="ItemQueue"
		>
			<section
				className="h-48 shrink-0 border-b border-line"
				data-ui="ItemQueueActive"
			>
				<AnimatePresence
					initial={false}
					mode="wait"
				>
					<ItemQueuePresence key={active?.jobId ?? "empty"}>
						{active !== undefined && activeLine !== undefined ? (
							<ItemProductionRow
								line={activeLine}
								reserved
								backdrop={
									activeLine.artwork === undefined ? null : (
										<ItemLineBackdrop
											sourceUrl={game.getResourceUrlFn(activeLine.artwork)}
											progress={
												active.durationMs === 0
													? 1
													: 1 - active.remainingMs / active.durationMs
											}
										/>
									)
								}
								actions={
									<ItemJobCancel
										ownerItemId={ownerItemId}
										jobId={active.jobId}
										lineId={active.lineId}
										disabled={disabled}
									/>
								}
								inputs={
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
								}
								status={
									<span className="text-foreground">
										{match(active.status)
											.with("running", () => null)
											.with("paused", () => translator.textFn("Paused"))
											.with("awaiting-output", () =>
												translator.textFn("Waiting for space"),
											)
											.exhaustive()}
										{active.status === "running" ? (
											<span className="inline-block min-w-[6ch] text-right tabular-nums">
												{formatDurationFn(active.remainingMs, "countdown")}
											</span>
										) : null}
									</span>
								}
							/>
						) : (
							<Status
								icon={Inbox}
								iconTone="primary"
								title={
									<span className="text-accent">
										{translator.textFn("Nothing is being made right now.")}
									</span>
								}
								description={
									<>
										{translator.textFn("Available slots")}:{" "}
										<strong className="tabular-nums">
											{Math.max(0, capacity - occupied)}
										</strong>
									</>
								}
								variant="flat"
							/>
						)}
					</ItemQueuePresence>
				</AnimatePresence>
			</section>
			<div
				className="flex min-h-0 flex-1 flex-col overflow-auto"
				data-ui="ItemQueuePending"
			>
				<AnimatePresence
					initial={false}
					mode="wait"
				>
					<ItemQueuePresence key={requests.length === 0 ? "empty" : "requests"}>
						{requests.length === 0 ? (
							<Status
								icon={ListOrdered}
								title={translator.textFn("Your queue is empty.")}
								description={translator.textFn(
									"Choose something to make in Lines.",
								)}
								size="large"
								variant="flat"
							/>
						) : (
							<>
								<ol className="shrink-0 divide-y divide-line">
									<AnimatePresence initial={false}>
										{requests.map((request) => {
											const line = lines.find(
												(candidate) => candidate.id === request.lineId,
											);
											return line === undefined ? null : (
												<QueuedLine
													key={request.requestId}
													ownerItemId={ownerItemId}
													line={line}
													requestId={request.requestId}
													disabled={disabled}
												/>
											);
										})}
									</AnimatePresence>
								</ol>
								<div className="shrink-0 pb-[50cqh]">
									<div className="flex justify-end py-3">
										<LinkButton
											className="inline-flex items-center gap-2 text-sm"
											disabled={clear.disabled}
											onClick={clear.clearFn}
										>
											<ListX className="size-4" />
											{translator.textFn("Clear queue")}
										</LinkButton>
									</div>
									<SectionEnd />
								</div>
							</>
						)}
					</ItemQueuePresence>
				</AnimatePresence>
			</div>
		</section>
	);
};
