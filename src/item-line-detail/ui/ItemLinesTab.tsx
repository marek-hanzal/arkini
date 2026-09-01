import { ListX, SearchX, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import {
	itemDetailFadeMotion,
	itemDetailMotionTransition,
} from "~/item-detail-frame/ui/ItemDetailMotion";
import { ItemLineRow } from "~/item-line-detail/ui/ItemLineRow";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { useItemLineSearch } from "~/item-line-detail/ui/useItemLineSearch";
import { Scrollable } from "~/ui/ui/Scrollable";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

const autoFocusPadding = 12;
const autoFocusLayoutAttempts = 24;

const useItemLinesAutoFocus = ({
	focusLineId,
	focusLineVisible,
	itemId,
	stale,
}: {
	readonly focusLineId: string | undefined;
	readonly focusLineVisible: boolean;
	readonly itemId: string;
	readonly stale: boolean;
}) => {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const rowByLineIdRef = useRef(new Map<string, HTMLElement>());
	const focusIntentRef = useRef({
		itemId,
		lineId: focusLineId,
		settled: false,
		visible: focusLineVisible,
	});
	if (focusIntentRef.current.itemId !== itemId) {
		focusIntentRef.current = {
			itemId,
			lineId: focusLineId,
			settled: false,
			visible: focusLineVisible,
		};
		rowByLineIdRef.current.clear();
	}

	useLayoutEffect(() => {
		const intent = focusIntentRef.current;
		if (intent.settled || intent.lineId === undefined || !intent.visible || stale) {
			intent.settled = true;
			return;
		}
		let attempts = 0;
		let frame: number | undefined;
		const attemptFn = () => {
			if (focusIntentRef.current !== intent || intent.settled) return;
			const container = scrollContainerRef.current;
			const row = rowByLineIdRef.current.get(intent.lineId ?? "");
			if (container !== null && row !== undefined) {
				const containerRect = container.getBoundingClientRect();
				const rowRect = row.getBoundingClientRect();
				if (
					containerRect.height > 0 &&
					rowRect.height > 0 &&
					containerRect.width > 0 &&
					rowRect.width > 0
				) {
					if (rowRect.top < containerRect.top || rowRect.bottom > containerRect.bottom) {
						const visibleTop = containerRect.top + autoFocusPadding;
						const visibleBottom = containerRect.bottom - autoFocusPadding;
						const delta =
							rowRect.height > visibleBottom - visibleTop || rowRect.top < visibleTop
								? rowRect.top - visibleTop
								: rowRect.bottom - visibleBottom;
						container.scrollTop = Math.max(0, container.scrollTop + delta);
					}
					intent.settled = true;
					return;
				}
			}
			attempts++;
			if (attempts >= autoFocusLayoutAttempts) {
				intent.settled = true;
				return;
			}
			frame = requestAnimationFrame(attemptFn);
		};
		frame = requestAnimationFrame(attemptFn);
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	}, [
		itemId,
	]);

	const registerRowFn = useCallback((lineId: string, row: HTMLElement | null) => {
		if (row === null) {
			rowByLineIdRef.current.delete(lineId);
		} else {
			rowByLineIdRef.current.set(lineId, row);
		}
	}, []);

	return {
		registerRowFn,
		scrollContainerRef,
	} as const;
};

const availabilityOptions = [
	{
		label: "Available",
		value: "available",
	},
	{
		label: "All",
		value: "all",
	},
] as const satisfies readonly {
	readonly label: string;
	readonly value: "available" | "all";
}[];

const ItemLinesEmptyState = ({
	children,
	dataUi,
	icon,
}: {
	readonly children: ReactNode;
	readonly dataUi: string;
	readonly icon: LucideIcon;
}) => {
	const Icon = icon;
	return (
		<div
			className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted"
			data-ui={dataUi}
		>
			<div className="grid max-w-sm justify-items-center gap-2">
				<Icon className="size-6 text-subtle" />
				{children}
			</div>
		</div>
	);
};

/** Renders the authoritative visible product-line overview inside Item Detail. */
export const ItemLinesTab = ({
	definitionItemId,
	disabled = false,
	initialQuery,
	lines,
	renderIdentity,
	stale = false,
}: {
	readonly definitionItemId?: string;
	readonly disabled?: boolean;
	readonly initialQuery?: string;
	readonly lines: Extract<
		ItemDetailLinesProjection.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
	readonly stale?: boolean;
}) => {
	const {
		availabilityFilter,
		availableLineCount,
		filteredLines,
		normalizedQuery,
		query,
		setAvailabilityFilterFn,
		setQueryFn,
	} = useItemLineSearch(lines, initialQuery, stale);
	const { registerRowFn, scrollContainerRef } = useItemLinesAutoFocus({
		focusLineId: lines.focusLineId,
		focusLineVisible: filteredLines.some((line) => line.lineId === lines.focusLineId),
		itemId: lines.itemId,
		stale,
	});
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemLinesTab"
		>
			<div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row">
				<motion.div
					layout
					className="min-w-0 flex-1"
					data-ui="ItemLinesSearch"
					transition={itemDetailMotionTransition}
				>
					<input
						type="search"
						value={query}
						className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder="Search lines…"
						onChange={(event) => setQueryFn(event.currentTarget.value)}
					/>
				</motion.div>
				<AnimatePresence initial={false}>
					{stale || availableLineCount === lines.line.length ? null : (
						<motion.div
							key="availability-filter"
							layout
							className="shrink-0"
							{...itemDetailFadeMotion}
						>
							<SegmentedControl
								dataUi="ItemLinesAvailabilityFilter"
								onChangeFn={setAvailabilityFilterFn}
								optionDataUi="ItemLinesAvailabilityOption"
								options={availabilityOptions.map((option) => ({
									...option,
									disabled:
										option.value === "available" && availableLineCount === 0,
								}))}
								size="compact"
								value={availabilityFilter}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<Scrollable
				ref={scrollContainerRef}
				className="flex-1 pr-1"
			>
				<AnimatePresence
					initial={false}
					mode="wait"
				>
					{lines.line.length === 0 && normalizedQuery === "" ? (
						<motion.div
							key="visible-empty"
							{...itemDetailFadeMotion}
						>
							<ItemLinesEmptyState
								dataUi="ItemLinesVisibleEmpty"
								icon={ListX}
							>
								<p>No product line is currently visible.</p>
							</ItemLinesEmptyState>
						</motion.div>
					) : filteredLines.length === 0 ? (
						<motion.div
							key="search-empty"
							{...itemDetailFadeMotion}
						>
							<ItemLinesEmptyState
								dataUi="ItemLinesSearchEmpty"
								icon={SearchX}
							>
								<p>No visible lines match “{normalizedQuery}”.</p>
							</ItemLinesEmptyState>
						</motion.div>
					) : (
						<motion.div
							key="line-list"
							className="ak-list grid gap-1"
							data-ui="TileLinesList"
							animate={{
								opacity: 1,
							}}
							exit={{
								opacity: 0,
							}}
							initial={{
								opacity: 0,
							}}
							transition={itemDetailMotionTransition}
						>
							<AnimatePresence
								initial={false}
								mode="popLayout"
							>
								{filteredLines.map((line) => (
									<ItemLineRow
										ref={(row) => registerRowFn(line.lineId, row)}
										key={line.lineId}
										definitionItemId={definitionItemId}
										disabled={disabled}
										line={line}
										ownerItemId={lines.itemId}
										renderIdentity={renderIdentity}
										stale={stale}
									/>
								))}
							</AnimatePresence>
						</motion.div>
					)}
				</AnimatePresence>
			</Scrollable>
		</div>
	);
};
