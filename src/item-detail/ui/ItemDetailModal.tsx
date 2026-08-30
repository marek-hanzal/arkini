import { Effect, Equal } from "effect";
import { motion } from "motion/react";
import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailInfoFn } from "~/engine/item-detail/fn/readItemDetailInfoFn";
import { readItemDetailTabsFn } from "~/engine/item-detail/fn/readItemDetailTabsFn";
import { readItemDetailIdentityFx } from "~/engine/item-detail/read/readItemDetailIdentityFx";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import {
	ItemDetailHeader,
	type ItemDetailHeaderIdentityRenderer,
} from "~/item-detail-frame/ui/ItemDetailHeader";
import type { ItemDetailState, ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { useRetainedItemDetailProjection } from "~/item-detail-frame/ui/useRetainedItemDetailProjection";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLinesTab } from "~/item-line-detail/ui/ItemLinesTab";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { useItemDetailLines } from "~/item-line-detail/ui/useItemDetailLines";
import { projectItemDetailQueueFx } from "~/item-detail/fx/projectItemDetailQueueFx";
import { ItemDefinitionInfoTab } from "~/item-detail/ui/ItemDefinitionInfoTab";
import { ItemInfoTab } from "~/item-detail/ui/ItemInfoTab";
import { ItemQueueTab } from "~/item-detail/ui/ItemQueueTab";
import { ItemSourcesTab } from "~/item-detail/ui/ItemSourcesTab";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { dialogFocusableSelector } from "~/ui/focus/dialogFocusableSelector";
import { useDialogFocusContainment } from "~/ui/focus/useDialogFocusContainment";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";

import "./item-detail.css";

type ItemDefinitionDetailProjection =
	| (ComponentProps<typeof ItemDefinitionInfoTab>["definition"] & {
			readonly kind: "available";
	  })
	| {
			readonly kind: "unavailable";
	  };

type ItemDetailIdentityProjection =
	| {
			readonly kind: "available";
			readonly definitionId: IdSchema.Type;
			readonly itemId: IdSchema.Type;
			readonly title: string;
			readonly sourceUrl: string;
			readonly compositeUrl?: string;
	  }
	| {
			readonly kind: "unavailable";
	  };

type ItemDetailQueueProjection = Effect.Success<ReturnType<typeof projectItemDetailQueueFx>>;

type ItemDetailSourcesProjection =
	| ComponentProps<typeof ItemSourcesTab>["sources"]
	| {
			readonly kind: "unavailable";
	  };

type ItemDetailProjectionTarget =
	| {
			readonly kind: "runtime";
			readonly itemId: IdSchema.Type;
	  }
	| {
			readonly kind: "definition";
			readonly itemId: IdSchema.Type;
	  };

const unavailable = {
	kind: "unavailable",
} as const;

const useItemDefinitionDetail = (itemId: IdSchema.Type): ItemDefinitionDetailProjection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ItemDefinitionDetailProjection => {
			const item = game.config.items[itemId];
			if (item === undefined) return unavailable;
			return {
				kind: "available",
				itemId: item.id,
				title: item.title,
				sourceUrl: game.getResourceUrl(item.asset.default[0]),
				...(item.asset.default[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(item.asset.default[1]),
						}),
				description: item.description,
				itemType: item.type,
				storageScope: item.scope,
				maxStackSize: item.maxStackSize,
				ownedQuantity: runtime.items.reduce(
					(total, candidate) =>
						candidate.item.id === item.id ? total + candidate.quantity : total,
					0,
				),
				...(item.maxCount === undefined
					? {}
					: {
							maxCount: item.maxCount,
						}),
				...(item.charges === undefined
					? {}
					: {
							totalCharges: item.charges.amount,
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};

const useItemDetailIdentity = (itemId: IdSchema.Type): ItemDetailIdentityProjection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ItemDetailIdentityProjection => {
			const identity = game.readOrThrow(
				readItemDetailIdentityFx({
					itemId,
					runtime,
				}),
			);
			if (identity.kind === "unavailable") return unavailable;
			return {
				kind: "available",
				definitionId: identity.definitionId,
				itemId: identity.itemId,
				title: identity.title,
				sourceUrl: game.getResourceUrl(identity.sourceResourceIds[0]),
				...(identity.sourceResourceIds[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(identity.sourceResourceIds[1]),
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};

const useItemDetailInfo = (itemId: IdSchema.Type): readItemDetailInfoFn.Result => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): readItemDetailInfoFn.Result =>
			readItemDetailInfoFn({
				itemId,
				runtime,
			}),
		[
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, (left, right) => {
		if (left.kind !== right.kind) return false;
		if (left.kind === "unavailable" || right.kind === "unavailable") return true;
		return (
			left.itemId === right.itemId &&
			left.description === right.description &&
			left.itemType === right.itemType &&
			left.storageScope === right.storageScope &&
			left.location.kind === right.location.kind &&
			(left.location.kind !== "board" ||
				right.location.kind !== "board" ||
				left.location.space === right.location.space) &&
			left.quantity === right.quantity &&
			left.maxStackSize === right.maxStackSize &&
			left.ownedQuantity === right.ownedQuantity &&
			left.maxCount === right.maxCount &&
			left.charges?.remaining === right.charges?.remaining &&
			left.charges?.total === right.charges?.total
		);
	});
};

const useItemDetailQueue = (itemId: IdSchema.Type): ItemDetailQueueProjection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ItemDetailQueueProjection =>
			game.readOrThrow(
				projectItemDetailQueueFx({
					game,
					itemId,
					runtime,
				}),
			),
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};

const useItemDetailSources = (target: ItemDetailProjectionTarget): ItemDetailSourcesProjection => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ItemDetailSourcesProjection => {
			const projection = game.readOrThrow(
				readItemDetailSourcesFx({
					target: {
						kind,
						itemId,
					},
					runtime,
				}),
			);
			if (projection.kind === "unavailable") return unavailable;
			const target = game.config.items[projection.targetDefinitionItemId];
			if (target === undefined) return unavailable;
			return {
				kind: "available",
				itemId: projection.itemId,
				targetTitle: target.title,
				source: projection.source.flatMap((source) => {
					const configured = game.config.items[source.ownerDefinitionItemId];
					if (configured === undefined) return [];
					const owner = runtime.items.find(
						(candidate) => candidate.id === source.ownerItemId,
					);
					if (owner === undefined) return [];
					return [
						{
							ownerItemId: source.ownerItemId,
							ownerDefinitionItemId: source.ownerDefinitionItemId,
							title: configured.title,
							sourceUrl: game.getResourceUrl(owner.item.asset.default[0]),
							...(configured.asset.default[1] === undefined
								? {}
								: {
										compositeUrl: game.getResourceUrl(
											configured.asset.default[1],
										),
									}),
							space: source.space,
							line: source.line,
						} satisfies ComponentProps<
							typeof ItemSourcesTab
						>["sources"]["source"][number],
					];
				}),
			};
		},
		[
			game,
			itemId,
			kind,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};

const useItemDetailTabs = (
	target: ItemDetailProjectionTarget,
	sources: ItemDetailSourcesProjection,
): readonly ItemDetailTabEnumSchema.Type[] => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailTabsFn({
				target:
					kind === "runtime"
						? {
								kind,
								item: runtime.items.find((item) => item.id === itemId),
							}
						: {
								kind,
							},
				sources,
			}),
		[
			game,
			itemId,
			kind,
			sources,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};

const visibleDialog = {
	opacity: 1,
	y: 0,
};

const exitingDialog = {
	opacity: 0,
	y: 8,
};

const useItemDetailMotion = ({
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
	const completedPhaseRef = useRef<ItemDetailState["phase"] | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		state.phase,
		state.generation,
	]);

	const completeMotionPhase = () => {
		if (completedPhaseRef.current === state.phase) return;
		match(state)
			.with(
				{
					phase: "entering",
				},
				({ generation }) => {
					completedPhaseRef.current = state.phase;
					RendererRuntime.runSync(itemDetail.completeEnterFx(generation));
				},
			)
			.with(
				{
					phase: "open",
				},
				() => undefined,
			)
			.with(
				{
					phase: "exiting",
				},
				({ generation }) => {
					completedPhaseRef.current = state.phase;
					RendererRuntime.runSync(itemDetail.completeExitFx(generation));
				},
			)
			.exhaustive();
	};

	const visual = match(state)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			() => ({
				backdropOpacity: 1,
				dialog: visibleDialog,
			}),
		)
		.with(
			{
				phase: "exiting",
			},
			() => ({
				backdropOpacity: 0,
				dialog: exitingDialog,
			}),
		)
		.exhaustive();

	return {
		...visual,
		completeMotionPhase,
	};
};

const useItemDetailFocus = ({
	phase,
	origin,
	restoreFocus,
	focusKey,
}: {
	readonly phase: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>["phase"];
	readonly origin: HTMLElement | null;
	readonly restoreFocus: boolean;
	readonly focusKey: string;
}) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const originRef = useRef(origin);
	const restoreFocusRef = useRef(restoreFocus);
	useLayoutEffect(() => {
		originRef.current = origin;
		restoreFocusRef.current = restoreFocus;
	}, [
		origin,
		restoreFocus,
	]);

	useEffect(() => {
		dialogRef.current?.focus();
		return () => {
			if (!restoreFocusRef.current) return;
			const latestOrigin = originRef.current;
			if (
				latestOrigin !== null &&
				latestOrigin.isConnected &&
				latestOrigin.matches(dialogFocusableSelector) &&
				!latestOrigin.hidden &&
				latestOrigin.closest("[inert]") === null &&
				latestOrigin.style.display !== "none" &&
				latestOrigin.style.visibility !== "hidden" &&
				latestOrigin.style.pointerEvents !== "none"
			) {
				latestOrigin.focus();
				return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, []);

	useEffect(() => {
		if (phase !== "open") return;
		const dialog = dialogRef.current;
		const selectedTab = dialog?.querySelector<HTMLElement>(
			'[data-ui="ItemDetailTabs"] button[aria-selected="true"]:not([disabled])',
		);
		(selectedTab ?? dialog?.querySelector<HTMLElement>(dialogFocusableSelector))?.focus();
	}, [
		focusKey,
		phase,
	]);

	const keepFocusInside = useDialogFocusContainment({
		dialogRef,
	});

	return {
		dialogRef,
		keepFocusInside,
	};
};

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
} as const satisfies Record<ItemDetailTabEnumSchema.Type, string>;

const BadgeCount = ({
	count,
	dataUi,
	label,
}: {
	readonly count: number;
	readonly dataUi: string;
	readonly label?: string;
}) => (
	<span
		className="min-w-5 rounded-full bg-warning/20 px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold tabular-nums text-foreground"
		data-ui={dataUi}
	>
		{label === undefined ? count : `${label}${count > 1 ? ` ×${count}` : ""}`}
	</span>
);

const ItemDetailTabs = ({
	active,
	disabled,
	lineCount,
	queueCount,
	stale = false,
	tabs,
	target,
}: {
	readonly active: ItemDetailTabEnumSchema.Type;
	readonly disabled: boolean;
	readonly lineCount?: number;
	readonly queueCount?: number;
	readonly stale?: boolean;
	readonly tabs: readonly ItemDetailTabEnumSchema.Type[];
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
	readonly identity?: ItemDetailIdentityProjection;
	readonly info?: readItemDetailInfoFn.Result;
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
	readonly lines?: ItemDetailLinesProjection.Projection;
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
	readonly sources?: ItemDetailSourcesProjection;
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
	readonly identity?: ItemDetailIdentityProjection;
	readonly info?: readItemDetailInfoFn.Result;
	readonly linesSearchQuery?: string;
	readonly lines?: ItemDetailLinesProjection.Projection;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
	readonly sources?: ItemDetailSourcesProjection;
	readonly stale: boolean;
	readonly tab: ItemDetailTabEnumSchema.Type;
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
interface ItemDetailModalProps {
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
