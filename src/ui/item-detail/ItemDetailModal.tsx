import { motion } from "motion/react";
import { useEffect } from "react";
import { match } from "ts-pattern";

import { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { useItemDetailTabs } from "~/bridge/item-detail/useItemDetailTabs";
import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import { ItemInfoTab } from "~/ui/item-detail/ItemInfoTab";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";
import { ItemQueueTab } from "~/ui/item-detail/ItemQueueTab";
import type { ItemDetailState } from "~/ui/item-detail/ItemDetailControl";
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
} as const satisfies Record<ItemDetailTab, string>;

const ItemDetailHeaderArtwork = ({
	identity,
}: {
	readonly identity: Extract<
		useItemDetailIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
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
	readonly identity: Extract<
		useItemDetailIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
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
	itemId,
	tabs,
}: {
	readonly active: ItemDetailTab;
	readonly disabled: boolean;
	readonly itemId: string;
	readonly tabs: readonly ItemDetailTab[];
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
					className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent/10 hover:text-foreground aria-selected:bg-accent/15 aria-selected:text-foreground"
					aria-selected={tab === active}
					disabled={disabled}
					data-tab={tab}
					onClick={() =>
						itemDetail.openItemDetail({
							itemId,
							tab,
						})
					}
				>
					{tabLabel[tab]}
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
	itemId,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
}) => {
	const liveLines = useItemDetailLines(itemId);
	const lines = useRetainedItemDetailProjection({
		available: liveLines.kind === "available",
		targetKey: itemId,
		value: liveLines,
	});
	if (lines.value?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Line detail is unavailable.
			</div>
		);
	}
	return (
		<ItemLinesTab
			disabled={disabled || lines.stale}
			lines={lines.value}
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

const ItemDetailContent = ({
	disabled,
	itemId,
	tab,
}: {
	readonly disabled: boolean;
	readonly itemId: string;
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
				itemId={itemId}
			/>
		))
		.with("queue", () => (
			<ItemQueueContent
				disabled={disabled}
				itemId={itemId}
			/>
		))
		.exhaustive();

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
	const liveIdentity = useItemDetailIdentity(state.target.itemId);
	const liveTabs = useItemDetailTabs(state.target.itemId);
	const retainedIdentity = useRetainedItemDetailProjection({
		available: liveIdentity.kind === "available",
		targetKey: state.target.itemId,
		value: liveIdentity,
	});
	const retainedTabs = useRetainedItemDetailProjection({
		available: liveTabs.length > 0,
		targetKey: state.target.itemId,
		value: liveTabs,
	});
	const identity = retainedIdentity.value;
	const tabs = retainedTabs.value ?? [];
	const stale = retainedIdentity.stale || retainedTabs.stale;
	const motionState = useItemDetailMotion({
		state,
	});
	const focus = useItemDetailFocus({
		phase: state.phase,
		origin: state.target.origin,
		restoreFocus: state.phase === "exiting" ? state.restoreFocus : true,
	});

	useEffect(() => {
		if (stale || liveTabs.includes(state.target.tab)) return;
		itemDetail.openItemDetail({
			itemId: state.target.itemId,
		});
	}, [
		itemDetail,
		state.target.itemId,
		state.target.tab,
		liveTabs,
		stale,
	]);

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
				data-runtime-id={state.target.itemId}
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
					key={`${state.target.itemId}:${state.target.tab}`}
					className="flex min-h-0 flex-1 flex-col"
					data-ui="ItemDetailContentScene"
					data-stale={stale ? "true" : "false"}
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
					{identity?.kind === "available" ? (
						<ItemDetailHeader
							disabled={state.phase === "exiting"}
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
						active={state.target.tab}
						disabled={stale || state.phase === "exiting"}
						itemId={state.target.itemId}
						tabs={tabs}
					/>
					<div className="flex min-h-0 flex-1 overflow-hidden pt-4">
						<ItemDetailContent
							disabled={stale || state.phase === "exiting"}
							itemId={state.target.itemId}
							tab={state.target.tab}
						/>
					</div>
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
