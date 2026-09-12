import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";

interface EditorVirtualCollectionProps<T> {
	readonly items: ReadonlyArray<T>;
	readonly itemKeyFn: (item: T) => string;
	readonly renderItemFn: (item: T) => ReactNode;
	readonly estimatedRowHeight: number;
	readonly gapRem: number;
	readonly minColumnWidthRem?: number;
}

/** Mounts only visible collection rows inside the existing Editor page scroll owner. */
export const EditorVirtualCollection = <T,>({
	items,
	itemKeyFn,
	renderItemFn,
	estimatedRowHeight,
	gapRem,
	minColumnWidthRem,
}: EditorVirtualCollectionProps<T>) => {
	const [element, setElementFn] = useState<HTMLDivElement | null>(null);
	const [geometry, setGeometryFn] = useState({
		columns: 1,
		gap: 0,
		margin: 0,
	});
	const scrollElement =
		element?.closest<HTMLDivElement>(
			'[data-ui="EditorSectionPage"][data-ui-content-mode="scroll"]',
		) ?? null;
	const getScrollElementFn = useCallback(
		() => scrollElement,
		[
			scrollElement,
		],
	);
	useLayoutEffect(() => {
		if (element === null || scrollElement === null) return;
		const measureFn = () => {
			const rem =
				Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			const gap = gapRem * rem;
			const columns =
				minColumnWidthRem === undefined
					? 1
					: Math.max(
							1,
							Math.floor(
								(element.clientWidth + gap) / (minColumnWidthRem * rem + gap),
							),
						);
			const margin =
				element.getBoundingClientRect().top -
				scrollElement.getBoundingClientRect().top +
				scrollElement.scrollTop;
			setGeometryFn((current) =>
				current.columns === columns && current.gap === gap && current.margin === margin
					? current
					: {
							columns,
							gap,
							margin,
						},
			);
		};
		measureFn();
		const observer = new ResizeObserver(measureFn);
		observer.observe(element);
		observer.observe(scrollElement);
		// Alerts above a catalog can change its offset without changing the viewport.
		const content = element.closest('[data-ui="EditorSectionPageContent"]');
		if (content !== null) observer.observe(content);
		return () => observer.disconnect();
	}, [
		element,
		scrollElement,
		gapRem,
		minColumnWidthRem,
	]);
	const { columns, gap, margin } = geometry;
	const getRowKeyFn = useCallback(
		(index: number) => {
			const item = items[index * columns];
			return item === undefined ? index : `${columns}:${itemKeyFn(item)}`;
		},
		[
			items,
			columns,
			itemKeyFn,
		],
	);
	const estimateSizeFn = useCallback(
		() => estimatedRowHeight,
		[
			estimatedRowHeight,
		],
	);
	const virtualizer = useVirtualizer({
		count: Math.ceil(items.length / columns),
		getScrollElement: getScrollElementFn,
		getItemKey: getRowKeyFn,
		estimateSize: estimateSizeFn,
		gap,
		scrollMargin: margin,
		overscan: 3,
	});
	return (
		<div
			ref={setElementFn}
			className="relative min-w-0"
			data-ui="EditorVirtualCollection"
			style={{
				height: virtualizer.getTotalSize(),
			}}
		>
			{virtualizer.getVirtualItems().map((row) => (
				<div
					key={row.key}
					ref={virtualizer.measureElement}
					data-index={row.index}
					className="absolute left-0 top-0 grid w-full min-w-0"
					style={{
						gap,
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
						transform: `translateY(${row.start - margin}px)`,
					}}
				>
					{items.slice(row.index * columns, (row.index + 1) * columns).map((item) => (
						<div
							key={itemKeyFn(item)}
							className="grid min-w-0"
						>
							{renderItemFn(item)}
						</div>
					))}
				</div>
			))}
		</div>
	);
};
