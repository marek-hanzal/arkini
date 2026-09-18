import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { ItemJobCancel } from "~/item-detail/ui/ItemJobCancel";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { Factory, ListPlus, Star, X } from "lucide-react";
import { useCallback } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useItemLineMakeController } from "~/item-detail/ui/useItemLineMakeController";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemLineDefaultController } from "~/item-detail/ui/useItemLineDefaultController";
import { useItemLineCancelController } from "~/item-detail/ui/useItemLineCancelController";
import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";
import type { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

const linePresenceMotion = {
	initial: {
		height: 0,
		opacity: 0,
	},
	animate: {
		height: "auto",
		opacity: 1,
	},
	exit: {
		height: 0,
		opacity: 0,
	},
	transition: {
		duration: 0.3,
		ease: "easeInOut" as const,
	},
};

interface ItemLineProps extends useItemLineMakeController.Props {
	readonly line: LineSchema.Type;
	readonly makeDisabled: boolean;
	readonly ruleDisabled: boolean;
	readonly status?: readItemLineStatusesFn.Status;
}

/** Live time is separate from debounced status so Tick cannot postpone a status change. */
const ItemLineCountdown = ({
	ownerItemId,
	lineId,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly lineId: IdSchema.Type;
}) => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const job = runtime.jobs.find(
				(job) => job.ownerItemId === ownerItemId && job.lineId === lineId,
			);
			return (Math.max(0, job?.remainingMs ?? 0) / 1000).toFixed(1);
		},
		[
			ownerItemId,
			lineId,
		],
	);
	const seconds = useRuntimeSelector(game, selectorFn);
	return (
		<span
			className="inline-block min-w-[6ch] text-right tabular-nums"
			data-ui="ItemLineCountdown"
		>
			{seconds} s
		</span>
	);
};

/** Progress follows the live job's captured duration, independently of debounced status. */
const ItemLineBackdrop = ({
	ownerItemId,
	lineId,
	artworkId,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly artworkId: IdSchema.Type;
}) => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const job = runtime.jobs.find(
				(job) => job.ownerItemId === ownerItemId && job.lineId === lineId,
			);
			return job === undefined
				? 0
				: job.durationMs === 0
					? 1
					: 1 - job.remainingMs / job.durationMs;
		},
		[
			ownerItemId,
			lineId,
		],
	);
	const progress = useRuntimeSelector(game, selectorFn);
	return (
		<div
			className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[42%] -translate-x-1/2 opacity-45 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
			data-ui="ItemLineBackdrop"
		>
			<ItemArtwork
				className="size-full"
				imageClassName="object-cover"
				sourceUrl={game.getResourceUrlFn(artworkId)}
				colorFraction={progress}
			/>
		</div>
	);
};

const ItemLine = ({ line, makeDisabled, ruleDisabled, status, ...props }: ItemLineProps) => {
	const game = useGameEngine();
	const present = useIsPresent();
	const disabled = props.disabled || !present;
	const controller = useItemLineMakeController({
		ownerItemId: props.ownerItemId,
		lineId: props.lineId,
		disabled: disabled || makeDisabled,
	});
	const defaultController = useItemLineDefaultController({
		ownerItemId: props.ownerItemId,
		lineId: props.lineId,
		authoredDefault: line.default,
		disabled,
	});
	const cancelController = useItemLineCancelController({
		ownerItemId: props.ownerItemId,
		lineId: line.id,
		requestId: status?.requestId,
		disabled,
	});
	const translator = useTranslator();
	const state = status?.state ?? "idle";
	const statusLabel = match(state)
		.with("idle", () => null)
		.with("waiting-inputs", () => translator.textFn("Waiting for materials"))
		.with("waiting-start", () => translator.textFn("Waiting to start"))
		.with("running", () => translator.textFn("Running"))
		.with("paused", () => translator.textFn("Paused"))
		.with("awaiting-output", () => translator.textFn("Waiting for space"))
		.with("queued", () => translator.textFn("Queued"))
		.exhaustive();
	const extra =
		state === "waiting-inputs" || state === "waiting-start"
			? Math.max(0, (status?.queued ?? 0) - 1)
			: (status?.queued ?? 0);
	return (
		<motion.div
			{...linePresenceMotion}
			className="-mx-3 overflow-hidden border-t border-line px-3 first:border-t-0"
			data-ui="ItemLinePresence"
			inert={!present}
		>
			<article
				className="relative isolate py-11 transition-opacity duration-300 data-[ui-rule-disabled=true]:opacity-45"
				{...readDataUiFn({
					dataUi: "ItemLine",
					state: {
						ruleDisabled,
					},
				})}
				data-line-id={line.id}
			>
				{line.artwork === undefined ? null : (
					<ItemLineBackdrop
						ownerItemId={props.ownerItemId}
						lineId={line.id}
						artworkId={line.artwork}
					/>
				)}
				<div className="flex items-center gap-3">
					{line.artwork === undefined ? null : (
						<ItemArtwork
							className="size-10"
							sourceUrl={game.getResourceUrlFn(line.artwork)}
						/>
					)}
					<h3 className="min-w-0 text-lg font-semibold">{line.title}</h3>
					<span className="shrink-0 text-muted">
						· {formatDurationFn(line.runtimeMs)}
					</span>
					<div className="ml-auto flex shrink-0 items-center gap-8">
						<LinkButton
							className="inline-flex items-center gap-2 text-muted data-[ui-selected=false]:opacity-60 data-[ui-selected=true]:text-accent"
							disabled={defaultController.disabled}
							onClick={defaultController.toggleFn}
							{...readDataUiFn({
								dataUi: "ItemLineDefault",
								state: {
									selected: defaultController.selected,
								},
							})}
						>
							<Star className="size-5" />
							{translator.textFn("Default")}
						</LinkButton>
						<LinkButton
							className="inline-flex shrink-0 items-center gap-2"
							disabled={
								disabled ||
								makeDisabled ||
								controller.pending ||
								props.ownerItemId === undefined
							}
							onClick={controller.makeFn}
						>
							<ListPlus className="size-5" />
							{translator.textFn("Make")}
						</LinkButton>
					</div>
				</div>
				{line.description ? (
					<p className="mt-2 whitespace-pre-wrap text-muted">{line.description}</p>
				) : null}
				<div className="flex items-end justify-between gap-6">
					<ItemLineInputs
						ownerItemId={props.ownerItemId}
						line={line}
						idle={state === "idle"}
						disabled={disabled}
					/>
					<div className="mt-3 ml-auto flex min-h-5 shrink-0 items-center gap-5 text-sm">
						{statusLabel !== null ? (
							<p
								className="shrink-0 text-foreground"
								data-ui="ItemLineStatus"
							>
								{statusLabel}
								{state === "running" ? (
									<>
										{" "}
										·{" "}
										<ItemLineCountdown
											ownerItemId={props.ownerItemId}
											lineId={line.id}
										/>
									</>
								) : null}
								{state === "queued"
									? ` ${status?.queued ?? 0}`
									: extra > 0
										? ` (+${extra})`
										: ""}
							</p>
						) : null}
						{status?.jobId !== undefined ? (
							<ItemJobCancel
								ownerItemId={props.ownerItemId}
								jobId={status.jobId}
								lineId={line.id}
								disabled={disabled}
							/>
						) : null}
						{status?.requestId !== undefined ? (
							<LinkButton
								className="inline-flex items-center gap-2"
								disabled={cancelController.disabled}
								onClick={cancelController.cancelFn}
							>
								<X className="size-4" />
								{translator.textFn("Cancel")}
							</LinkButton>
						) : null}
					</div>
				</div>
			</article>
		</motion.div>
	);
};

export const ItemLines = ({
	lines,
	disabledLineIds,
	ownerItemId,
	disabled,
	makeDisabled,
}: {
	readonly lines: readonly LineSchema.Type[];
	readonly disabledLineIds: readonly string[];
	readonly ownerItemId?: IdSchema.Type;
	readonly disabled: boolean;
	readonly makeDisabled: boolean;
}) => {
	const translator = useTranslator();
	const statuses = useItemLinesStatus(ownerItemId);
	return (
		<section
			className="px-3"
			data-ui="ItemLines"
		>
			<AnimatePresence initial={false}>
				{lines.map((line) => (
					<ItemLine
						key={`line:${line.id}`}
						line={line}
						ruleDisabled={disabledLineIds.includes(line.id)}
						lineId={line.id}
						ownerItemId={ownerItemId}
						disabled={disabled}
						makeDisabled={makeDisabled}
						status={statuses.find((status) => status.lineId === line.id)}
					/>
				))}
				{lines.length === 0 ? (
					<motion.div
						key="empty"
						{...linePresenceMotion}
						className="overflow-hidden"
					>
						<Status
							icon={Factory}
							title={translator.textFn("Nothing to make right now.")}
							variant="flat"
							size="large"
						/>
					</motion.div>
				) : (
					<motion.div
						key="end"
						{...linePresenceMotion}
						className="overflow-hidden"
					>
						<div className="pb-[50cqh]">
							<SectionEnd />
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	);
};
