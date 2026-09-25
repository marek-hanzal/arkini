import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { Factory, Info, Star } from "lucide-react";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useItemLineMakeController } from "~/item-detail/ui/useItemLineMakeController";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { ItemLineBackdrop } from "~/item-detail/ui/ItemLineBackdrop";
import { useItemLineDefaultController } from "~/item-detail/ui/useItemLineDefaultController";
import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";
import type { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tooltip } from "~/ui/ui/Tooltip";
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
	readonly materialsAvailable: boolean;
	readonly ruleDisabled: boolean;
	readonly blockingHint?: string;
	readonly status?: readItemLineStatusesFn.Status;
}

/** Progress follows the live job's captured duration, independently of debounced status. */
const ItemLineProgressBackdrop = ({
	ownerItemId,
	lineUid,
	artworkId,
	materialsAvailable,
	ruleDisabled,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly artworkId: IdSchema.Type;
	readonly materialsAvailable: boolean;
	readonly ruleDisabled: boolean;
}) => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const job = runtime.jobs.find(
				(job) => job.ownerItemId === ownerItemId && job.lineUid === lineUid,
			);
			return job === undefined
				? undefined
				: job.durationMs === 0
					? 1
					: 1 - job.remainingMs / job.durationMs;
		},
		[
			ownerItemId,
			lineUid,
		],
	);
	const progress = useRuntimeSelector(game, selectorFn);
	return (
		<ItemLineBackdrop
			sourceUrl={game.getResourceUrlFn(artworkId)}
			progress={progress}
			materialsAvailable={materialsAvailable}
			ruleDisabled={ruleDisabled}
		/>
	);
};

const ItemLine = ({
	line,
	makeDisabled,
	materialsAvailable,
	ruleDisabled,
	blockingHint,
	status,
	...props
}: ItemLineProps) => {
	const present = useIsPresent();
	const disabled = props.disabled || !present;
	const controller = useItemLineMakeController({
		ownerItemId: props.ownerItemId,
		lineUid: props.lineUid,
		disabled: disabled || makeDisabled,
	});
	const defaultController = useItemLineDefaultController({
		ownerItemId: props.ownerItemId,
		lineUid: props.lineUid,
		authoredDefault: line.default,
		disabled,
	});
	const translator = useTranslator();
	const state = status?.state ?? "idle";
	return (
		<motion.div
			{...linePresenceMotion}
			layout="position"
			className="overflow-hidden border-t border-line first:border-t-0"
			data-ui="ItemLinePresence"
			inert={!present}
		>
			<ItemProductionRow
				line={line}
				activateFn={
					disabled ||
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
							lineUid={line.uid}
							artworkId={line.artwork}
							materialsAvailable={materialsAvailable}
							ruleDisabled={ruleDisabled}
						/>
					)
				}
				leadingControl={
					<Tooltip
						content={
							defaultController.selected
								? translator.textFn(
										"Stop making this recipe when you click the item on the board.",
									)
								: translator.textFn(
										"Make this recipe when you click the item on the board.",
									)
						}
					>
						<LinkButton
							className="grid size-14 shrink-0 place-items-center rounded-lg text-muted transition-[color,background-color,opacity] duration-300 hover:bg-surface-raised/50 data-[ui-selected=false]:opacity-60 data-[ui-selected=true]:text-accent"
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
					</Tooltip>
				}
				actions={
					<ItemLineWorkControls
						ownerItemId={props.ownerItemId}
						lineUid={line.uid}
						jobId={status?.jobId}
						queued={status?.queued ?? 0}
						running={state === "running"}
						waitingMaterials={state === "waiting-inputs"}
						disabled={disabled}
					/>
				}
				inputs={
					<ItemLineInputs
						ownerItemId={props.ownerItemId}
						line={line}
						idle={state === "idle"}
						disabled={disabled}
					/>
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
	disabledLineUids,
	lineBlockingHints,
	materialReadyLineUids,
	ownerItemId,
	disabled,
	makeDisabled,
}: {
	readonly lines: readonly LineSchema.Type[];
	readonly disabledLineUids: readonly string[];
	readonly lineBlockingHints: Readonly<Record<string, string | undefined>>;
	readonly materialReadyLineUids: readonly string[];
	readonly ownerItemId?: IdSchema.Type;
	readonly disabled: boolean;
	readonly makeDisabled: boolean;
}) => {
	const translator = useTranslator();
	const statuses = useItemLinesStatus(ownerItemId);
	return (
		<section data-ui="ItemLines">
			<AnimatePresence initial={false}>
				{lines.map((line) => (
					<ItemLine
						key={`line:${line.uid}`}
						line={line}
						ruleDisabled={disabledLineUids.includes(line.uid)}
						materialsAvailable={materialReadyLineUids.includes(line.uid)}
						blockingHint={lineBlockingHints[line.uid]}
						lineUid={line.uid}
						ownerItemId={ownerItemId}
						disabled={disabled}
						makeDisabled={makeDisabled}
						status={statuses.find((status) => status.lineUid === line.uid)}
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
						<div className="p-6">
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
