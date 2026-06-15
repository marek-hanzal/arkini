import type { RectLike } from "~/play/types";

const readPx = (value: string) => Number.parseFloat(value) || 0;

/**
 * Measures the box used by absolute `inset-0` item tiles inside bordered board/inventory cells.
 * `getBoundingClientRect()` returns the border box, which is 1px off once the real tile renders.
 */
export function paddingBoxRect(element: Element): RectLike {
	const rect = element.getBoundingClientRect();
	const style = window.getComputedStyle(element);
	const borderLeft = readPx(style.borderLeftWidth);
	const borderRight = readPx(style.borderRightWidth);
	const borderTop = readPx(style.borderTopWidth);
	const borderBottom = readPx(style.borderBottomWidth);

	return {
		left: rect.left + borderLeft,
		top: rect.top + borderTop,
		width: Math.max(0, rect.width - borderLeft - borderRight),
		height: Math.max(0, rect.height - borderTop - borderBottom),
	};
}
