import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const rectFromElement = (element: HTMLElement): TileEngine.Rect => {
	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
};

export const rectCenter = (rect: TileEngine.Rect) => ({
	x: rect.left + rect.width / 2,
	y: rect.top + rect.height / 2,
});

export const containsPoint = (rect: DOMRect, x: number, y: number) =>
	x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
