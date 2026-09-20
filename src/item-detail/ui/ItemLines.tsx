import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { Factory, Info, Star } from "lucide-react";
import { useCallback } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useItemLineMakeController } from "~/item-detail/ui/useItemLineMakeController";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { ItemLineBackdrop } from "~/item-detail/ui/ItemLineBackdrop";
import { useItemLineDefaultController } from "~/item-detail/ui/useItemLineDefaultController";
import { useItemLineCancelController } from "~/item-detail/ui/useItemLineCancelController";
import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";
import type { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";
import { ItemLineWorkControls } from "~/item-detail/ui/ItemLineWorkControls";
import { ItemProductionRow } from "~/item-detail/ui/ItemProductionRow";

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
	readonly blockingHint?: string;
	readonly status?: readItemLineStatusesFn.Status;
}

/** Progress follows the live job's captured duration, independently of debounced status. */
const ItemLineProgressBackdrop = ({
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
				? undefined
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
		<ItemLineBackdrop
			sourceUrl={game.getResourceUrlFn(artworkId)}
			progress={progress}
		/>
	);
};

const ItemLine = ({
	line,
	makeDisabled,
	ruleDisabled,
	blockingHint,
	status,
	...props
}: ItemLineProps) => {
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
		.with("waiting-inputs", () => null)
		.with("waiting-start", () => translator.textFn("Waiting to start"))
		.with("running", () => null)
		.with("paused", () => translator.textFn("Paused"))
		.with("awaiting-output", () => translator.textFn("Waiting for space"))
		.with("queued", () => translator.textFn("Queued"))
		.exhaustive();
	return (
		<motion.div
			{...linePresenceMotion}
			layout="position"
			className="-mx-3 overflow-hidden border-t border-line px-3 first:border-t-0"
			data-ui="ItemLinePresence"
			inert={!present}
		>
			<ItemProductionRow
				line={line}
				activateFn={
					state === "waiting-inputs"
						? cancelController.disabled
							? undefined
							: cancelController.cancelFn
						: disabled ||
								makeDisabled ||
								controller.pending ||
								props.ownerItemId === undefined
							? undefined
							: controller.makeFn
				}
				ruleDisabled={ruleDisabled}
				backdrop={
					line.artwork === undefined ? null : (
						<ItemLineProgressBackdrop
							ownerItemId={props.ownerItemId}
							lineId={line.id}
							artworkId={line.artwork}
						/>
					)
				}
				actions={
					<>
						<LinkButton
							className="absolute top-3 left-0 grid size-14 place-items-center rounded-lg text-muted transition-[color,background-color,opacity] duration-300 hover:bg-surface-raised/50 data-[ui-selected=false]:opacity-60 data-[ui-selected=true]:text-accent"
							title={translator.textFn("Default")}
							disabled={defaultController.disabled}
							onClick={defaultController.toggleFn}
							{...readDataUiFn({
								dataUi: "ItemLineDefault",
								state: {
									selected: defaultController.selected,
								},
							})}
						>
							<Star className="size-8" />
						</LinkButton>
						<ItemLineWorkControls
							ownerItemId={props.ownerItemId}
							lineId={line.id}
							jobId={status?.jobId}
							queued={status?.queued ?? 0}
							running={state === "running"}
							waitingMaterials={state === "waiting-inputs"}
							disabled={disabled}
						/>
					</>
				}
				inputs={
					<ItemLineInputs
						ownerItemId={props.ownerItemId}
						line={line}
						idle={state === "idle"}
						disabled={disabled}
					/>
				}
				status={
					<>
						{statusLabel !== null ? (
							<p
								className="shrink-0 text-foreground"
								data-ui="ItemLineStatus"
							>
								{statusLabel}
							</p>
						) : null}
					</>
				}
				overlay={
					<AnimatePresence
						initial={false}
						mode="wait"
					>
						{ruleDisabled && blockingHint !== undefined ? (
							<motion.div
								key={blockingHint}
								initial={{
									opacity: 0,
								}}
								animate={{
									opacity: 1,
								}}
								exit={{
									opacity: 0,
								}}
								transition={{
									duration: 0.25,
									ease: "easeInOut",
								}}
								className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-16 py-20"
								data-ui="ItemLineBlockingHints"
							>
								<p className="flex max-w-3xl items-center gap-4 rounded-xl bg-surface/90 px-6 py-4 text-center text-2xl leading-relaxed font-semibold text-accent">
									<Info className="size-8 shrink-0" />
									<span className="whitespace-pre-wrap">{blockingHint}</span>
								</p>
							</motion.div>
						) : null}
					</AnimatePresence>
				}
			/>
		</motion.div>
	);
};

export const ItemLines = ({
	lines,
	disabledLineIds,
	lineBlockingHints,
	ownerItemId,
	disabled,
	makeDisabled,
}: {
	readonly lines: readonly LineSchema.Type[];
	readonly disabledLineIds: readonly string[];
	readonly lineBlockingHints: Readonly<Record<string, string | undefined>>;
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
						blockingHint={lineBlockingHints[line.id]}
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
							<SectionEnd>
								{translator.textFn("That's everything you can make for now!")}
							</SectionEnd>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	);
};
