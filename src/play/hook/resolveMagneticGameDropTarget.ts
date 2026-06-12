import { boardCellNodeId } from "~/board/boardIdentity";
import { inventorySlotNodeId } from "~/inventory/inventoryIdentity";
import type { MagneticDropContext } from "~/drag/hook/useDraggableControl";
import type {
	GameDragSource,
	GameDropData,
	GameDropTarget,
	GameVisualMeta,
	RectLike,
} from "~/play/types";

const magneticDropThresholdPx = 30;

export function resolveMagneticGameDropTarget({
	source,
	dragRect,
}: MagneticDropContext<string, GameDragSource, GameVisualMeta>): GameDropData | null {
	if (source.source.kind === "board") {
		const cell = nearestMagneticElement("[data-board-cell]", dragRect);
		if (!cell) return null;

		const [x, y] = (cell.element.getAttribute("data-board-cell") ?? "").split(":").map(Number);
		if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

		const nodeId = cell.element.getAttribute("data-drag-node-id") ?? boardCellNodeId(x, y);
		return {
			targetId: nodeId,
			targetNodeId: nodeId,
			target: {
				kind: "cell",
				x,
				y,
				boardItemId: cell.element.getAttribute("data-board-item-id") || null,
			},
		} satisfies GameDropData;
	}

	const slot = nearestMagneticElement("[data-inventory-slot]", dragRect);
	if (!slot) return null;

	const slotIndex = Number(slot.element.getAttribute("data-inventory-slot"));
	if (!Number.isInteger(slotIndex)) return null;

	const nodeId = slot.element.getAttribute("data-drag-node-id") ?? inventorySlotNodeId(slotIndex);
	return {
		targetId: nodeId,
		targetNodeId: nodeId,
		target: {
			kind: "inventory-slot",
			slotIndex,
		} satisfies GameDropTarget,
	} satisfies GameDropData;
}

interface Point {
	x: number;
	y: number;
}

interface MagneticElement {
	element: HTMLElement;
	overlapArea: number;
	distance: number;
	centerDistance: number;
}

function nearestMagneticElement(selector: string, dragRect: RectLike): MagneticElement | null {
	const candidates = [
		...document.querySelectorAll<HTMLElement>(selector),
	]
		.map((element) => toMagneticElement(element, dragRect))
		.filter((candidate): candidate is MagneticElement => Boolean(candidate))
		.sort(
			(left, right) =>
				right.overlapArea - left.overlapArea ||
				left.distance - right.distance ||
				left.centerDistance - right.centerDistance,
		);

	return candidates[0] ?? null;
}

function toMagneticElement(element: HTMLElement, dragRect: RectLike): MagneticElement | null {
	const rect = element.getBoundingClientRect();
	const overlapArea = rectOverlapArea(dragRect, rect);
	const distance = rectDistance(dragRect, rect);
	if (overlapArea <= 0 && distance > magneticDropThresholdPx) return null;

	return {
		element,
		overlapArea,
		distance,
		centerDistance: distanceBetween(rectCenter(dragRect), rectCenter(rect)),
	};
}

function rectOverlapArea(left: RectLike, right: RectLike) {
	const width = Math.max(
		0,
		Math.min(left.left + left.width, right.left + right.width) -
			Math.max(left.left, right.left),
	);
	const height = Math.max(
		0,
		Math.min(left.top + left.height, right.top + right.height) - Math.max(left.top, right.top),
	);
	return width * height;
}

function rectDistance(left: RectLike, right: RectLike) {
	const dx = Math.max(
		right.left - (left.left + left.width),
		left.left - (right.left + right.width),
		0,
	);
	const dy = Math.max(
		right.top - (left.top + left.height),
		left.top - (right.top + right.height),
		0,
	);
	return Math.hypot(dx, dy);
}

function rectCenter(rect: RectLike): Point {
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}

function distanceBetween(left: Point, right: Point) {
	return Math.hypot(left.x - right.x, left.y - right.y);
}
