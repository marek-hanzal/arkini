import { motion } from "motion/react";
import { useEffect } from "react";
import { match } from "ts-pattern";

import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import { useItemDefinitionDetail } from "~/bridge/item-detail/useItemDefinitionDetail";
import { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { useItemDetailTabs } from "~/bridge/item-detail/useItemDetailTabs";
import { ItemDefinitionInfoTab } from "~/ui/item-detail/ItemDefinitionInfoTab";
import type { ItemDetailState, ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";
import { ItemInfoTab } from "~/ui/item-detail/ItemInfoTab";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";
import { ItemQueueTab } from "~/ui/item-detail/ItemQueueTab";
import { ItemSourcesTab } from "~/ui/item-detail/ItemSourcesTab";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { useItemDetailFocus } from "~/ui/item-detail/useItemDetailFocus";
import { useItemDetailMotion } from "~/ui/item-detail/useItemDetailMotion";
import { useRetainedItemDetailProjection } from "~/ui/item-detail/useRetainedItemDetailProjection";

const transition = {
	duration: 0.22,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const tabLabel = {
	info: "Info",
	lines: "Lines",
	queue: "Queue",
	sources: "Sources",
} as const satisfies Record<ItemDetailTab, string>;

interface HeaderIdentity {
	readonly title: string;
	readonly subtitle?: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
}

const ItemDetailHeaderArtwork = ({ identity }: { readonly identity: HeaderIdentity }) => (
	<div
		className="relative size-16 shrink-0"
		data-ui="ItemDetailHeaderArtwork"
	>
		<img
			className="absolute inset-0 size-full object-contain drop-shadow-[0_0.45rem_0.65rem_color-mix(in_srgb,var(--ak-overlay)_35%,transparent)]"
			src={identity.sourceUrl}
			alt=""
			draggable={false}
		/>
		{identity.compositeUrl === undefined ? null : (
			<img
				className="absolute inset-0 size-full object-contain drop-shadow-[0_0.45rem_0.65rem_color-mix(in_srgb,var(--ak-overlay)_35%,transparent)]"
				src={identity.compositeUrl}
				alt=""
				draggable={false}
			/>
		)}
	</div>
);

const ItemDetailHeader = ({
	disabled,
	identity,
	stale,
}: {
	readonly disabled: boolean;
	readonly identity: HeaderIdentity;
	readonly stale: boolean;
}) => {
	const itemDetail = useItemDetailControl();
	return (
		<header className="flex min-w-0 items-center justify-between gap-4 border-b border-line pb-3">
			<div className="flex min-w-0 items-center gap-3">
				<ItemDetailHeaderArtwork identity={identity} />
				<div className="min-w-0">
					<h2
						id="item-detail-title"
						className="truncate text-lg font-semibold leading-tight"
					>
						{identity.title}
					</h2>
					{identity.subtitle === undefined ? null : (
						<p className="mt-1 truncate text-sm text-muted">{identity.subtitle}</p>
					)}
					{stale ? (
						<p className="mt-1 text-xs font-medium text-warning">
							This item no longer exists. Showing the last known detail.
						</p>
					) : null}
				</div>
			</div>
			<button
				type="button"
				className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed"
				aria-label="Close item detail"
				disabled={disabled}
				onClick={() => void itemDetail.close()}
			>
				×
			</button>
		</header>
	);
};

const ItemDetailTabs = ({
	active,
	disabled,
	lineCount,
	tabs,
	target,
}: {
	readonly active: ItemDetailTab;
	readonly disabled: boolean;
	readonly lineCount?: number;
	readonly tabs: readonly ItemDetailTab[];
	readonly target: ItemDetailTarget;
}) => {
	const itemDetail = useItemDetailControl();
	return (
		<nav
			className="flex min-w-0 gap-1 overflow-x-auto border-b border-line py-2"
			aria-label="Item detail tabs"
			data-ui="ItemDetailTabs"
		>
			{tabs.map((tab) => (
				<button
					key={tab}
					type="button"
					className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent/10 hover:text-foreground aria-selected:bg-accent/15 aria-selected:text-foreground disabled:cursor-not-allowed"
					aria-selected={tab === active}
					disabled={disabled}
					data-tab={tab}
					onClick={() =>
						target.kind === "runtime"
							? itemDetail.openItemDetail({
									itemId: target.itemId,
									tab,
								})
							: itemDetail.openItemDefinitionDetail({
									itemId: target.itemId,
									tab: tab === "sources" ? tab : "info",
								})
					}
				>
					{tabLabel[tab]}
					{tab === "lines" && lineCount !== undefined ? (
						<span
							className="min-w-5 rounded-full bg-surface-raised/75 px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold tabular-nums text-subtle"
							data-ui="ItemDetailTabCount"
						>
							{lineCount}
						</span>
					) : null}
				</button>
			))}
		</nav>
	);
};

const ItemInfoContent = ({
	disabled,
	itemId,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
}) => {
	const liveIdentity = useItemDetailIdentity(itemId);
	const liveInfo = useItemDetailInfo(itemId);
	const identity = useRetainedItemDetailProjection({
		available: liveIdentity.kind === "available",
		targetKey: itemId,
		value: liveIdentity,
	});
	const info = useRetainedItemDetailProjection({
		available: liveInfo.kind === "available",
		targetKey: itemId,
		value: liveInfo,
	});
	if (identity.value?.kind !== "available" || info.value?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Item detail is unavailable.
			</div>
		);
	}
	return (
		<div
			className={
				disabled || identity.stale || info.stale
					? "min-h-0 flex-1 opacity-70"
					: "min-h-0 flex-1"
			}
			inert={disabled || identity.stale || info.stale}
		>
			<ItemInfoTab
				identity={identity.value}
				info={info.value}
			/>
		</div>
	);
};

const ItemLinesContent = ({
	disabled,
	lines,
}: {
	readonly disabled: boolean;
	readonly lines?: useItemDetailLines.Projection;
}) => {
	if (lines?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Line detail is unavailable.
			</div>
		);
	}
	return (
		<ItemLinesTab
			disabled={disabled}
			lines={lines}
		/>
	);
};

const ItemQueueContent = ({
	disabled,
	itemId,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
}) => {
	const liveQueue = useItemDetailQueue(itemId);
	const queue = useRetainedItemDetailProjection({
		available: liveQueue.kind === "available",
		targetKey: itemId,
		value: liveQueue,
	});
	if (queue.value?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Queue detail is unavailable.
			</div>
		);
	}
	return (
		<ItemQueueTab
			disabled={disabled || queue.stale}
			queue={queue.value}
		/>
	);
};

const ItemSourcesContent = ({
	disabled,
	sources,
}: {
	readonly disabled: boolean;
	readonly sources?: useItemDetailSources.Projection;
}) => {
	if (sources?.kind !== "available" || sources.source.length === 0) {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Source detail is unavailable.
			</div>
		);
	}
	return (
		<ItemSourcesTab
			disabled={disabled}
			sources={sources}
		/>
	);
};

const ItemDetailContent = ({
	disabled,
	itemId,
	lines,
	sources,
	tab,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
	readonly lines?: useItemDetailLines.Projection;
	readonly sources?: useItemDetailSources.Projection;
	readonly tab: ItemDetailTab;
}) =>
	match(tab)
		.with("info", () => (
			<ItemInfoContent
				disabled={disabled}
				itemId={itemId}
			/>
		))
		.with("lines", () => (
			<ItemLinesContent
				disabled={disabled}
				lines={lines}
			/>
		))
		.with("queue", () => (
			<ItemQueueContent
				disabled={disabled}
				itemId={itemId}
			/>
		))
		.with("sources", () => (
			<ItemSourcesContent
				disabled={disabled}
				sources={sources}
			/>
		))
		.exhaustive();

const RuntimeItemDetailScene = ({
	disabled,
	target,
}: {
	readonly disabled: boolean;
	readonly target: Extract<
		ItemDetailTarget,
		{
			readonly kind: "runtime";
		}
	>;
}) => {
	const itemDetail = useItemDetailControl();
	const liveIdentity = useItemDetailIdentity(target.itemId);
	const liveLines = useItemDetailLines(target.itemId);
	const liveSources = useItemDetailSources({
		kind: "runtime",
		itemId: target.itemId,
	});
	const liveTabs = useItemDetailTabs(
		{
			kind: "runtime",
			itemId: target.itemId,
		},
		liveSources,
	);
	const retainedIdentity = useRetainedItemDetailProjection({
		available: liveIdentity.kind === "available",
		targetKey: `runtime:${target.itemId}`,
		value: liveIdentity,
	});
	const retainedTabs = useRetainedItemDetailProjection({
		available: liveTabs.length > 0,
		targetKey: `runtime:${target.itemId}`,
		value: liveTabs,
	});
	const retainedLines = useRetainedItemDetailProjection({
		available: liveLines.kind === "available",
		targetKey: `runtime:${target.itemId}`,
		value: liveLines,
	});
	const retainedSources = useRetainedItemDetailProjection({
		available: liveSources.kind === "available",
		targetKey: `runtime:${target.itemId}`,
		value: liveSources,
	});
	const identity = retainedIdentity.value;
	const lines = retainedLines.value;
	const sources = retainedSources.value;
	const tabs = retainedTabs.value ?? [];
	const stale = retainedIdentity.stale || retainedTabs.stale;
	const lineCount = lines?.kind === "available" ? lines.line.length : undefined;

	useEffect(() => {
		if (stale || liveTabs.includes(target.tab)) return;
		itemDetail.openItemDetail({
			itemId: target.itemId,
		});
	}, [
		itemDetail,
		liveTabs,
		stale,
		target.itemId,
		target.tab,
	]);

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailContentScene"
			data-stale={stale ? "true" : "false"}
		>
			{identity?.kind === "available" ? (
				<ItemDetailHeader
					disabled={disabled}
					identity={identity}
					stale={stale}
				/>
			) : (
				<header className="flex items-center justify-between border-b border-line pb-3">
					<h2
						id="item-detail-title"
						className="text-lg font-semibold"
					>
						Item unavailable
					</h2>
					<button
						type="button"
						className="grid size-9 cursor-pointer place-items-center border border-line bg-surface text-lg text-muted"
						onClick={() => void itemDetail.close()}
					>
						×
					</button>
				</header>
			)}
			<ItemDetailTabs
				active={target.tab}
				disabled={stale || disabled}
				lineCount={lineCount}
				tabs={tabs}
				target={target}
			/>
			<div
				className="flex min-h-0 flex-1 overflow-hidden pt-4"
				data-stale={stale ? "true" : "false"}
			>
				<ItemDetailContent
					disabled={stale || disabled}
					itemId={target.itemId}
					lines={lines}
					sources={sources}
					tab={target.tab}
				/>
			</div>
		</div>
	);
};

const DefinitionItemDetailScene = ({
	disabled,
	target,
}: {
	readonly disabled: boolean;
	readonly target: Extract<
		ItemDetailTarget,
		{
			readonly kind: "definition";
		}
	>;
}) => {
	const definition = useItemDefinitionDetail(target.itemId);
	const sources = useItemDetailSources({
		kind: "definition",
		itemId: target.itemId,
	});
	const tabs = useItemDetailTabs(
		{
			kind: "definition",
			itemId: target.itemId,
		},
		sources,
	);
	const itemDetail = useItemDetailControl();
	useEffect(() => {
		if (tabs.includes(target.tab)) return;
		itemDetail.openItemDefinitionDetail({
			itemId: target.itemId,
		});
	}, [
		itemDetail,
		tabs,
		target.itemId,
		target.tab,
	]);
	if (definition.kind === "unavailable") {
		return (
			<header className="flex items-center justify-between border-b border-line pb-3">
				<h2
					id="item-detail-title"
					className="text-lg font-semibold"
				>
					Item unavailable
				</h2>
				<button
					type="button"
					className="grid size-9 cursor-pointer place-items-center border border-line bg-surface text-lg text-muted"
					onClick={() => void itemDetail.close()}
				>
					×
				</button>
			</header>
		);
	}
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailContentScene"
			data-stale="false"
		>
			<ItemDetailHeader
				disabled={disabled}
				identity={definition}
				stale={false}
			/>
			<ItemDetailTabs
				active={target.tab}
				disabled={disabled}
				tabs={tabs}
				target={target}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden pt-4">
				{target.tab === "info" ? (
					<ItemDefinitionInfoTab definition={definition} />
				) : (
					<ItemSourcesContent
						disabled={disabled}
						sources={sources}
					/>
				)}
			</div>
		</div>
	);
};

const ItemDetailDialog = ({
	state,
}: {
	readonly state: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>;
}) => {
	const itemDetail = useItemDetailControl();
	const motionState = useItemDetailMotion({
		state,
	});
	const focus = useItemDetailFocus({
		phase: state.phase,
		origin: state.target.origin,
		restoreFocus: state.phase === "exiting" ? state.restoreFocus : true,
	});
	const disabled = state.phase === "exiting";
	return (
		<motion.div
			className="absolute inset-0 z-[70] grid cursor-default place-items-center overflow-hidden bg-overlay/70 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="ItemDetailBackdrop"
			data-phase={state.phase}
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: motionState.backdropOpacity,
			}}
			transition={transition}
			onPointerDown={(event) => {
				if (event.target !== event.currentTarget || state.phase === "exiting") return;
				void itemDetail.close();
			}}
		>
			<motion.div
				ref={focus.dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="item-detail-title"
				className="flex h-[min(46rem,100%)] max-h-full w-full max-w-5xl cursor-default flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-[0_2rem_5rem_color-mix(in_srgb,var(--ak-overlay)_58%,transparent),0_0_0_1px_color-mix(in_srgb,var(--ak-line-strong)_45%,transparent)] outline-none"
				data-ui="ItemDetailModal"
				data-tab={state.target.tab}
				data-target-kind={state.target.kind}
				data-runtime-id={state.target.kind === "runtime" ? state.target.itemId : undefined}
				data-item-id={state.target.itemId}
				tabIndex={-1}
				initial={{
					opacity: 0,
					y: 10,
				}}
				animate={motionState.dialog}
				transition={transition}
				onAnimationComplete={motionState.completeMotionPhase}
				onKeyDown={focus.keepFocusInside}
			>
				<motion.div
					key={`${state.target.kind}:${state.target.itemId}:${state.target.tab}`}
					className="flex min-h-0 flex-1 flex-col"
					data-ui="ItemDetailContentTransition"
					initial={{
						opacity: 0,
						y: 6,
					}}
					animate={{
						opacity: 1,
						y: 0,
					}}
					transition={transition}
				>
					{match(state.target)
						.with(
							{
								kind: "runtime",
							},
							(target) => (
								<RuntimeItemDetailScene
									disabled={disabled}
									target={target}
								/>
							),
						)
						.with(
							{
								kind: "definition",
							},
							(target) => (
								<DefinitionItemDetailScene
									disabled={disabled}
									target={target}
								/>
							),
						)
						.exhaustive()}
				</motion.div>
			</motion.div>
		</motion.div>
	);
};

/** Renders the one active Item Detail modal over the unchanged tile scene. */
export const ItemDetailModal = () => {
	const itemDetail = useItemDetailControl();
	return match(itemDetail.state)
		.with(
			{
				phase: "closed",
			},
			() => null,
		)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			{
				phase: "exiting",
			},
			(state) => <ItemDetailDialog state={state} />,
		)
		.exhaustive();
};
