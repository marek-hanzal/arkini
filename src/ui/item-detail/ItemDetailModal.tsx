import { motion } from "motion/react";
import { type ReactNode, useEffect } from "react";
import { match } from "ts-pattern";

import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import { useItemDefinitionDetail } from "~/bridge/item-detail/useItemDefinitionDetail";
import { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { useItemDetailTabs } from "~/bridge/item-detail/useItemDetailTabs";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { BadgeCount } from "~/ui/badge/BadgeCount";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { ItemDefinitionInfoTab } from "~/ui/item-detail/ItemDefinitionInfoTab";
import {
	ItemDetailHeader,
	type ItemDetailHeaderIdentityRenderer,
} from "~/ui/item-detail/ItemDetailHeader";
import type { ItemDetailState, ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";
import { ItemInfoTab } from "~/ui/item-detail/ItemInfoTab";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";
import type { ItemLineSummaryIdentityRenderer } from "~/ui/item-detail/ItemLineSummary";
import { ItemQueueTab } from "~/ui/item-detail/ItemQueueTab";
import { ItemSourcesTab } from "~/ui/item-detail/ItemSourcesTab";
import { useCloseItemDetail } from "~/ui/item-detail/useCloseItemDetail";
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

const ItemDetailTabs = ({
	active,
	disabled,
	lineCount,
	queueCount,
	stale = false,
	tabs,
	target,
}: {
	readonly active: ItemDetailTab;
	readonly disabled: boolean;
	readonly lineCount?: number;
	readonly queueCount?: number;
	readonly stale?: boolean;
	readonly tabs: readonly ItemDetailTab[];
	readonly target: ItemDetailTarget;
}) => {
	const itemDetail = useItemDetailControl();
	return (
		<nav
			className="flex min-w-0 gap-2 overflow-x-auto py-2"
			aria-label="Item detail tabs"
			data-ui="ItemDetailTabs"
		>
			{tabs.map((tab) => (
				<button
					key={tab}
					type="button"
					className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed ${tab === active ? selectableActiveClassName : selectableInactiveClassName}`}
					aria-selected={tab === active}
					disabled={disabled}
					data-tab={tab}
					onClick={() =>
						RendererRuntime.runSync(
							target.kind === "runtime"
								? stale
									? itemDetail.selectRetainedItemDetailTabFx({
											itemId: target.itemId,
											tab,
										})
									: itemDetail.openItemDetailFx({
											itemId: target.itemId,
											tab,
										})
								: itemDetail.openItemDefinitionDetailFx({
										itemId: target.itemId,
										tab: tab === "sources" ? tab : "info",
									}),
						)
					}
				>
					{tabLabel[tab]}
					{tab === "lines" && lineCount !== undefined ? (
						<BadgeCount
							count={lineCount}
							dataUi="ItemDetailTabCount"
						/>
					) : null}
					{tab === "queue" && queueCount !== undefined && queueCount > 0 ? (
						<BadgeCount
							count={queueCount}
							dataUi="ItemDetailQueueTabCount"
						/>
					) : null}
				</button>
			))}
		</nav>
	);
};

const ItemInfoContent = ({
	disabled,
	identity,
	info,
	stale,
}: {
	readonly disabled: boolean;
	readonly identity?: useItemDetailIdentity.Projection;
	readonly info?: useItemDetailInfo.Projection;
	readonly stale: boolean;
}) => {
	if (identity?.kind !== "available" || info?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Item detail is unavailable.
			</div>
		);
	}
	return (
		<div
			className={disabled ? "min-h-0 flex-1 opacity-70" : "min-h-0 flex-1"}
			inert={disabled}
		>
			<ItemInfoTab
				info={info}
				stale={stale}
			/>
		</div>
	);
};

const ItemLinesContent = ({
	definitionItemId,
	disabled,
	initialQuery,
	lines,
	renderIdentity,
	stale,
}: {
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly initialQuery?: string;
	readonly lines?: useItemDetailLines.Projection;
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
	readonly stale: boolean;
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
			definitionItemId={definitionItemId}
			disabled={disabled}
			initialQuery={initialQuery}
			lines={lines}
			renderIdentity={renderIdentity}
			stale={stale}
		/>
	);
};

const ItemQueueContent = ({
	disabled,
	itemId,
	stale,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
	readonly stale: boolean;
}) => {
	const liveQueue = useItemDetailQueue(itemId);
	const queue = useRetainedItemDetailProjection({
		available: liveQueue.kind === "available",
		targetKey: itemId,
		value: liveQueue,
	});
	if (stale || queue.stale) {
		return (
			<div
				className="grid flex-1 place-items-center px-4 text-center text-sm text-muted"
				data-ui="ItemQueueStale"
			>
				Queue is unavailable because this item no longer exists.
			</div>
		);
	}
	if (queue.value?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Queue detail is unavailable.
			</div>
		);
	}
	return (
		<ItemQueueTab
			disabled={disabled}
			queue={queue.value}
		/>
	);
};

const ItemSourcesContent = ({
	disabled,
	sources,
	stale = false,
}: {
	readonly disabled: boolean;
	readonly sources?: useItemDetailSources.Projection;
	readonly stale?: boolean;
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
			stale={stale}
		/>
	);
};

const ItemDetailContent = ({
	definitionItemId,
	disabled,
	itemId,
	identity,
	info,
	linesSearchQuery,
	lines,
	renderLineIdentity,
	sources,
	stale,
	tab,
}: {
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly itemId: string;
	readonly identity?: useItemDetailIdentity.Projection;
	readonly info?: useItemDetailInfo.Projection;
	readonly linesSearchQuery?: string;
	readonly lines?: useItemDetailLines.Projection;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
	readonly sources?: useItemDetailSources.Projection;
	readonly stale: boolean;
	readonly tab: ItemDetailTab;
}) =>
	match(tab)
		.with("info", () => (
			<ItemInfoContent
				disabled={disabled}
				identity={identity}
				info={info}
				stale={stale}
			/>
		))
		.with("lines", () => (
			<ItemLinesContent
				definitionItemId={definitionItemId}
				disabled={disabled}
				initialQuery={linesSearchQuery}
				lines={lines}
				renderIdentity={renderLineIdentity}
				stale={stale}
			/>
		))
		.with("queue", () => (
			<ItemQueueContent
				disabled={disabled}
				itemId={itemId}
				stale={stale}
			/>
		))
		.with("sources", () => (
			<ItemSourcesContent
				disabled={disabled}
				sources={sources}
				stale={stale}
			/>
		))
		.exhaustive();

const ItemDetailBodyTransition = ({
	children,
	target,
}: {
	readonly children: ReactNode;
	readonly target: ItemDetailTarget;
}) => (
	<motion.div
		key={`${target.kind}:${target.itemId}:${target.tab}:${
			target.kind === "runtime" ? (target.linesSearchQuery ?? "") : ""
		}`}
		className="flex min-h-0 flex-1 flex-col"
		data-ui="ItemDetailContentTransition"
		data-tab={target.tab}
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
		{children}
	</motion.div>
);

const RuntimeItemDetailScene = ({
	disabled,
	renderIdentity,
	renderLineIdentity,
	target,
}: {
	readonly disabled: boolean;
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
	readonly target: Extract<
		ItemDetailTarget,
		{
			readonly kind: "runtime";
		}
	>;
}) => {
	const itemDetail = useItemDetailControl();
	const closeItemDetail = useCloseItemDetail();
	const liveIdentity = useItemDetailIdentity(target.itemId);
	const liveInfo = useItemDetailInfo(target.itemId);
	const liveLines = useItemDetailLines(target.itemId);
	const liveQueue = useItemDetailQueue(target.itemId);
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
	const retainedInfo = useRetainedItemDetailProjection({
		available: liveInfo.kind === "available",
		targetKey: `runtime:${target.itemId}`,
		value: liveInfo,
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
	const info = retainedInfo.value;
	const lines = retainedLines.value;
	const sources = retainedSources.value;
	const tabs = retainedTabs.value ?? [];
	const stale = retainedIdentity.stale || retainedTabs.stale;
	const lineCount = lines?.kind === "available" ? lines.line.length : undefined;
	const queueCount = liveQueue.kind === "available" ? liveQueue.request.length : undefined;

	useEffect(() => {
		if (stale || liveTabs.includes(target.tab)) return;
		RendererRuntime.runSync(
			itemDetail.openItemDetailFx({
				itemId: target.itemId,
			}),
		);
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
					renderIdentity={renderIdentity}
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
						onClick={() => closeItemDetail()}
					>
						×
					</button>
				</header>
			)}
			<ItemDetailTabs
				active={target.tab}
				disabled={disabled}
				lineCount={stale ? undefined : lineCount}
				queueCount={stale ? undefined : queueCount}
				stale={stale}
				tabs={tabs}
				target={target}
			/>
			<div
				className="flex min-h-0 flex-1 overflow-hidden pt-4"
				data-stale={stale ? "true" : "false"}
			>
				<ItemDetailBodyTransition target={target}>
					<ItemDetailContent
						definitionItemId={
							identity?.kind === "available" ? identity.definitionId : undefined
						}
						disabled={disabled}
						itemId={target.itemId}
						identity={identity}
						info={info}
						linesSearchQuery={target.linesSearchQuery}
						lines={lines}
						renderLineIdentity={renderLineIdentity}
						sources={sources}
						stale={stale}
						tab={target.tab}
					/>
				</ItemDetailBodyTransition>
			</div>
		</div>
	);
};

const DefinitionItemDetailScene = ({
	disabled,
	renderIdentity,
	target,
}: {
	readonly disabled: boolean;
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
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
	const closeItemDetail = useCloseItemDetail();
	useEffect(() => {
		if (tabs.includes(target.tab)) return;
		RendererRuntime.runSync(
			itemDetail.openItemDefinitionDetailFx({
				itemId: target.itemId,
			}),
		);
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
					onClick={() => closeItemDetail()}
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
				identity={{
					...definition,
					definitionId: definition.itemId,
				}}
				renderIdentity={renderIdentity}
				stale={false}
			/>
			<ItemDetailTabs
				active={target.tab}
				disabled={disabled}
				tabs={tabs}
				target={target}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden pt-4">
				<ItemDetailBodyTransition target={target}>
					{target.tab === "info" ? (
						<ItemDefinitionInfoTab definition={definition} />
					) : (
						<ItemSourcesContent
							disabled={disabled}
							sources={sources}
						/>
					)}
				</ItemDetailBodyTransition>
			</div>
		</div>
	);
};

const ItemDetailDialog = ({
	renderIdentity,
	renderLineIdentity,
	state,
}: {
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
	readonly state: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>;
}) => {
	const closeItemDetail = useCloseItemDetail();
	const motionState = useItemDetailMotion({
		state,
	});
	const focus = useItemDetailFocus({
		phase: state.phase,
		origin: state.target.origin,
		restoreFocus: state.phase === "exiting" ? state.restoreFocus : true,
		focusKey: `${state.target.kind}:${state.target.itemId}:${state.target.tab}`,
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
				closeItemDetail();
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
				{match(state.target)
					.with(
						{
							kind: "runtime",
						},
						(target) => (
							<RuntimeItemDetailScene
								disabled={disabled}
								renderIdentity={renderIdentity}
								renderLineIdentity={renderLineIdentity}
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
								renderIdentity={renderIdentity}
								target={target}
							/>
						),
					)
					.exhaustive()}
			</motion.div>
		</motion.div>
	);
};

/** Renders the one active Item Detail modal over the unchanged tile scene. */
export interface ItemDetailModalProps {
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
}

export const ItemDetailModal = ({ renderIdentity, renderLineIdentity }: ItemDetailModalProps) => {
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
			(state) => (
				<ItemDetailDialog
					renderIdentity={renderIdentity}
					renderLineIdentity={renderLineIdentity}
					state={state}
				/>
			),
		)
		.exhaustive();
};
