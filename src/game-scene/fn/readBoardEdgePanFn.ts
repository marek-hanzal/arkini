import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

interface ReadBoardEdgePanProps {
	readonly board: SurfaceLayout;
	readonly width: number;
	readonly height: number;
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	readonly pointerX: number;
	readonly pointerY: number;
	readonly deltaMs: number;
}

const edgeThreshold = 60;
const maximumSpeed = 1200;

const readAxisFn = (
	position: number,
	pointer: number,
	viewportSize: number,
	boardStart: number,
	boardSize: number,
	tileSize: number,
	deltaMs: number,
): number => {
	if (boardSize <= viewportSize) return position;
	const threshold = Math.min(edgeThreshold, viewportSize / 2);
	const direction =
		pointer < threshold
			? 1 - pointer / threshold
			: pointer > viewportSize - threshold
				? -(1 - (viewportSize - pointer) / threshold)
				: 0;
	const movement = (direction * maximumSpeed * deltaMs) / 1000;
	const minimum = viewportSize - boardStart - boardSize - tileSize;
	const maximum = tileSize - boardStart;
	// Free panning may already be outside these bounds; edge scrolling must never snap it back.
	if (movement > 0) return position + Math.min(movement, Math.max(0, maximum - position));
	if (movement < 0) return position + Math.max(movement, Math.min(0, minimum - position));
	return position;
};

/** Moves overflowing Board axes with one projected tile of breathing room past their edges. */
export const readBoardEdgePanFn = ({
	board,
	width,
	height,
	x,
	y,
	scale,
	pointerX,
	pointerY,
	deltaMs,
}: ReadBoardEdgePanProps): {
	readonly x: number;
	readonly y: number;
} => {
	if (
		width <= 0 ||
		height <= 0 ||
		scale <= 0 ||
		deltaMs <= 0 ||
		pointerX < 0 ||
		pointerY < 0 ||
		pointerX > width ||
		pointerY > height
	) {
		return {
			x,
			y,
		};
	}
	const tileSize = board.cellSize * scale;
	return {
		x: readAxisFn(x, pointerX, width, board.x * scale, board.width * scale, tileSize, deltaMs),
		y: readAxisFn(
			y,
			pointerY,
			height,
			board.y * scale,
			board.height * scale,
			tileSize,
			deltaMs,
		),
	};
};
