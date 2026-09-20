import { Clock, ListX, PackageSearch, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useCallback, type ReactNode } from "react";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { useItemLineWorkController } from "~/item-detail/ui/useItemLineWorkController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton } from "~/ui/ui/LinkButton";

interface ItemLineWorkControlsProps extends useItemLineWorkController.Props {
	readonly queued: number;
	readonly running: boolean;
	readonly waitingMaterials: boolean;
}

const workButtonClassName =
	"flex h-14 min-w-14 items-center justify-center gap-3 rounded-lg px-4 text-muted transition-colors duration-300 ease-out hover:bg-surface-raised/50 hover:text-accent hover:no-underline";

/** Collapsing width moves adjacent controls smoothly; exiting controls cannot accept clicks. */
const WorkGroup = ({ children }: { readonly children: ReactNode }) => {
	const present = useIsPresent();
	return (
		<motion.div
			className="overflow-hidden"
			initial={{
				width: 0,
				opacity: 0,
			}}
			animate={{
				width: "auto",
				opacity: 1,
			}}
			exit={{
				width: 0,
				opacity: 0,
			}}
			transition={{
				duration: 0.25,
				ease: "easeInOut",
			}}
			inert={!present}
		>
			<div className="flex w-max items-center gap-3 pl-3 whitespace-nowrap">{children}</div>
		</motion.div>
	);
};

/** Reads the displayed job's live time without waiting for debounced line status. */
const ItemLineCountdown = ({ jobId }: Pick<useItemLineWorkController.Props, "jobId">) => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const job = runtime.jobs.find((job) => job.id === jobId);
			return formatDurationFn(job?.remainingMs ?? 0, "countdown");
		},
		[
			jobId,
		],
	);
	const remaining = useRuntimeSelector(game, selectorFn);
	return (
		<span
			className="inline-block shrink-0 text-right tabular-nums"
			data-ui="ItemLineCountdown"
		>
			{remaining}
		</span>
	);
};

export const ItemLineWorkControls = ({
	queued,
	running,
	waitingMaterials,
	...props
}: ItemLineWorkControlsProps) => {
	const controller = useItemLineWorkController(props);
	const translator = useTranslator();
	const active = props.jobId !== undefined;
	return (
		<div
			className="flex items-center"
			data-ui="ItemLineWorkControls"
		>
			<AnimatePresence initial={false}>
				{queued > 0 ? (
					<WorkGroup key="queued">
						<Tooltip
							content={translator.textFn(
								"Cancel the planned batches of this recipe. Anything already cooking keeps going.",
							)}
						>
							<LinkButton
								className={workButtonClassName}
								disabled={controller.clearDisabled}
								onClick={controller.clearFn}
								data-ui="ItemLineClear"
							>
								<span className="text-xl font-semibold tabular-nums">
									x{queued}
								</span>
								<ListX className="size-8" />
							</LinkButton>
						</Tooltip>
					</WorkGroup>
				) : null}
				{waitingMaterials ? (
					<WorkGroup key="waiting-materials">
						<Tooltip
							content={translator.textFn(
								"Still missing a few ingredients. Bring them over to get things moving.",
							)}
						>
							<span
								className={workButtonClassName}
								data-ui="ItemLineWaitingMaterials"
							>
								<PackageSearch className="size-8" />
							</span>
						</Tooltip>
					</WorkGroup>
				) : null}
				{active ? (
					<WorkGroup key="active">
						<Tooltip
							content={translator.textFn(
								"One batch is in progress. This is how long it has left.",
							)}
						>
							<span
								className="flex h-14 items-center gap-3 pl-3 text-xl text-muted tabular-nums transition-colors duration-300 data-[ui-running=true]:text-accent"
								{...readDataUiFn({
									dataUi: "ItemLineActiveCount",
									state: {
										running,
									},
								})}
							>
								<Clock className="size-8 shrink-0" />
								<ItemLineCountdown jobId={props.jobId} />
							</span>
						</Tooltip>
						<Tooltip
							content={translator.textFn(
								"Stop this batch and throw it away. Materials already used are lost.",
							)}
						>
							<LinkButton
								className={workButtonClassName}
								disabled={controller.cancelJobDisabled}
								onClick={controller.cancelJobFn}
								data-ui="ItemLineAbort"
							>
								<Trash2 className="size-8" />
							</LinkButton>
						</Tooltip>
					</WorkGroup>
				) : null}
			</AnimatePresence>
		</div>
	);
};
