import type { Rectangle } from "electron";

const WINDOW_SCALE = 0.75;
const MAXIMUM_MIN_WIDTH = 480;
const MAXIMUM_MIN_HEIGHT = 360;

export function calculateInitialWindowBounds(workArea: Readonly<Rectangle>) {
	const width = Math.max(1, Math.floor(workArea.width * WINDOW_SCALE));
	const height = Math.max(1, Math.floor(workArea.height * WINDOW_SCALE));

	return {
		x: workArea.x + Math.floor((workArea.width - width) / 2),
		y: workArea.y + Math.floor((workArea.height - height) / 2),
		width,
		height,
		minWidth: Math.min(MAXIMUM_MIN_WIDTH, width),
		minHeight: Math.min(MAXIMUM_MIN_HEIGHT, height),
	};
}
