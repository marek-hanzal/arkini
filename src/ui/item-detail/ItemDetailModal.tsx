import { motion } from "motion/react";
import { useEffect } from "react";
import { match } from "ts-pattern";

import { useItemDetailIdentity } from "~/bridge/item-detail/useItemDetailIdentity";
import { useItemDetailInfo } from "~/bridge/item-detail/useItemDetailInfo";
import { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { useItemDetailQueue } from "~/bridge/item-detail/useItemDetailQueue";
import { useItemDetailStatus } from "~/bridge/item-detail/useItemDetailStatus";
import { useItemDetailTabs } from "~/bridge/item-detail/useItemDetailTabs";
import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import { ItemInfoTab } from "~/ui/item-detail/ItemInfoTab";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";
import { ItemQueueTab } from "~/ui/item-detail/ItemQueueTab";
import { readItemStatusPresentation, ItemStatusTab } from "~/ui/item-detail/ItemStatusTab";
import type { ItemDetailState } from "~/ui/item-detail/ItemDetailControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { useItemDetailFocus } from "~/ui/item-detail/useItemDetailFocus";
import { useItemDetailMotion } from "~/ui/item-detail/useItemDetailMotion";

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
	status: "Status",
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
}: {
	readonly disabled: boolean;
	readonly identity: Extract<
		useItemDetailIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
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
	itemId,
	tabs,
}: {
	readonly active: ItemDetailTab;
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

const ItemInfoContent = ({ itemId }: { readonly itemId: string }) => {
	const itemDetail = useItemDetailControl();
	const identity = useItemDetailIdentity(itemId);
	const info = useItemDetailInfo(itemId);
	useEffect(() => {
		if (identity.kind === "available" && info.kind === "available") return;
		void itemDetail.close();
	}, [
		identity.kind,
		info.kind,
		itemDetail,
	]);
	if (identity.kind === "unavailable" || info.kind === "unavailable") return null;
	return (
		<ItemInfoTab
			identity={identity}
			info={info}
		/>
	);
};

const ItemStatusContent = ({ itemId }: { readonly itemId: string }) => {
	const itemDetail = useItemDetailControl();
	const status = useItemDetailStatus(itemId);
	useEffect(() => {
		if (status.kind === "available") return;
		void itemDetail.close();
	}, [
		itemDetail,
		status.kind,
	]);
	if (status.kind === "unavailable") return null;
	return (
		<ItemStatusTab
			status={status}
			presentation={readItemStatusPresentation(status.state)}
		/>
	);
};

const ItemLinesContent = ({ itemId }: { readonly itemId: string }) => {
	const itemDetail = useItemDetailControl();
	const lines = useItemDetailLines(itemId);
	useEffect(() => {
		if (lines.kind === "available") return;
		void itemDetail.close();
	}, [
		itemDetail,
		lines.kind,
	]);
	if (lines.kind === "unavailable") return null;
	return <ItemLinesTab lines={lines} />;
};

const ItemQueueContent = ({ itemId }: { readonly itemId: string }) => {
	const itemDetail = useItemDetailControl();
	const queue = useItemDetailQueue(itemId);
	useEffect(() => {
		if (queue.kind === "available") return;
		void itemDetail.close();
	}, [
		itemDetail,
		queue.kind,
	]);
	if (queue.kind === "unavailable") return null;
	return <ItemQueueTab queue={queue} />;
};

const ItemDetailContent = ({
	itemId,
	tab,
}: {
	readonly itemId: string;
	readonly tab: ItemDetailTab;
}) =>
	match(tab)
		.with("info", () => <ItemInfoContent itemId={itemId} />)
		.with("status", () => <ItemStatusContent itemId={itemId} />)
		.with("lines", () => <ItemLinesContent itemId={itemId} />)
		.with("queue", () => <ItemQueueContent itemId={itemId} />)
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
	const identity = useItemDetailIdentity(state.target.itemId);
	const tabs = useItemDetailTabs(state.target.itemId);
	const motionState = useItemDetailMotion({
		state,
	});
	const focus = useItemDetailFocus({
		phase: state.phase,
		origin: state.target.origin,
		restoreFocus: state.phase === "exiting" ? state.restoreFocus : true,
	});

	useEffect(() => {
		if (identity.kind === "available" && tabs.length > 0) return;
		void itemDetail.close();
	}, [
		identity.kind,
		itemDetail,
		tabs.length,
	]);

	useEffect(() => {
		if (tabs.includes(state.target.tab)) return;
		itemDetail.openItemDetail({
			itemId: state.target.itemId,
			tab: "info",
		});
	}, [
		itemDetail,
		state.target.itemId,
		state.target.tab,
		tabs,
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
				{identity.kind === "available" ? (
					<>
						<ItemDetailHeader
							disabled={state.phase === "exiting"}
							identity={identity}
						/>
						<ItemDetailTabs
							active={state.target.tab}
							itemId={state.target.itemId}
							tabs={tabs}
						/>
						<div className="flex min-h-0 flex-1 overflow-hidden pt-4">
							<ItemDetailContent
								itemId={state.target.itemId}
								tab={state.target.tab}
							/>
						</div>
					</>
				) : null}
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
