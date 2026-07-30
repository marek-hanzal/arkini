import { useCallback, useLayoutEffect, useRef } from "react";

const autoFocusPadding = 12;
const autoFocusLayoutAttempts = 24;

export const scrollItemDetailLineIntoView = ({
	container,
	row,
}: {
	readonly container: HTMLElement;
	readonly row: HTMLElement;
}) => {
	const containerRect = container.getBoundingClientRect();
	const rowRect = row.getBoundingClientRect();
	if (
		containerRect.height <= 0 ||
		rowRect.height <= 0 ||
		containerRect.width <= 0 ||
		rowRect.width <= 0
	) {
		return "pending" as const;
	}
	if (rowRect.top >= containerRect.top && rowRect.bottom <= containerRect.bottom) {
		return "visible" as const;
	}
	const visibleTop = containerRect.top + autoFocusPadding;
	const visibleBottom = containerRect.bottom - autoFocusPadding;
	const delta =
		rowRect.height > visibleBottom - visibleTop || rowRect.top < visibleTop
			? rowRect.top - visibleTop
			: rowRect.bottom - visibleBottom;
	container.scrollTop = Math.max(0, container.scrollTop + delta);
	return "scrolled" as const;
};

export const useItemLinesAutoFocus = ({
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
		const attempt = () => {
			if (focusIntentRef.current !== intent || intent.settled) return;
			const container = scrollContainerRef.current;
			const row = rowByLineIdRef.current.get(intent.lineId ?? "");
			if (container !== null && row !== undefined) {
				const result = scrollItemDetailLineIntoView({
					container,
					row,
				});
				if (result !== "pending") {
					intent.settled = true;
					return;
				}
			}
			attempts++;
			if (attempts >= autoFocusLayoutAttempts) {
				intent.settled = true;
				return;
			}
			frame = requestAnimationFrame(attempt);
		};
		frame = requestAnimationFrame(attempt);
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	}, [
		itemId,
	]);

	const registerRow = useCallback((lineId: string, row: HTMLElement | null) => {
		if (row === null) {
			rowByLineIdRef.current.delete(lineId);
		} else {
			rowByLineIdRef.current.set(lineId, row);
		}
	}, []);

	return {
		registerRow,
		scrollContainerRef,
	} as const;
};
