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

interface ItemLineProps extends useItemLineMakeController.Props {
	readonly line: LineSchema.Type;
	readonly makeDisabled: boolean;
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

const ItemLine = ({ line, makeDisabled, status, ...props }: ItemLineProps) => {
	const controller = useItemLineMakeController({
		ownerItemId: props.ownerItemId,
		lineId: props.lineId,
		disabled: props.disabled || makeDisabled,
	});
	const defaultController = useItemLineDefaultController({
		ownerItemId: props.ownerItemId,
		lineId: props.lineId,
		authoredDefault: line.default,
		disabled: props.disabled,
	});
	const cancelController = useItemLineCancelController({
		ownerItemId: props.ownerItemId,
		lineId: line.id,
		requestId: status?.requestId,
		disabled: props.disabled,
	});
	const translator = useTranslator();
	const state = status?.state ?? "idle";
	const statusLabel = match(state)
		.with("idle", () => translator.textFn("Idle"))
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
		<article
			className="py-5"
			data-ui="ItemLine"
			data-line-id={line.id}
		>
			<div className="flex items-center gap-3">
				<h3 className="min-w-0 text-lg font-semibold">{line.title}</h3>
				<span className="shrink-0 text-muted">· {formatDurationFn(line.runtimeMs)}</span>
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
							props.disabled ||
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
				/>
				<div className="mt-3 ml-auto flex shrink-0 items-center gap-5 text-sm">
					<p
						className="shrink-0 text-foreground data-[ui-idle=true]:text-muted"
						{...readDataUiFn({
							dataUi: "ItemLineStatus",
							state: {
								idle: state === "idle",
							},
						})}
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
	);
};

export const ItemLines = ({
	lines,
	ownerItemId,
	disabled,
	makeDisabled,
}: {
	readonly lines: readonly LineSchema.Type[];
	readonly ownerItemId?: IdSchema.Type;
	readonly disabled: boolean;
	readonly makeDisabled: boolean;
}) => {
	const translator = useTranslator();
	const statuses = useItemLinesStatus(ownerItemId);
	if (lines.length === 0)
		return (
			<Status
				icon={Factory}
				title={translator.textFn("Nothing to make right now.")}
				variant="flat"
				size="large"
			/>
		);
	return (
		<section
			className="divide-y divide-line px-3"
			data-ui="ItemLines"
		>
			{lines.map((line) => (
				<ItemLine
					key={line.id}
					line={line}
					lineId={line.id}
					ownerItemId={ownerItemId}
					disabled={disabled}
					makeDisabled={makeDisabled}
					status={statuses.find((status) => status.lineId === line.id)}
				/>
			))}
		</section>
	);
};
