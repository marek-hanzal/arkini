import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

import { PointerDragThreshold } from "~/ui/constant/PointerDragThreshold";
import type { BoardGridCell, BoardGridPosition } from "~/board-authoring/type/BoardGridCell";

interface BoardGridDrag {
	phase: "dragging" | "pressed";
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly source: BoardGridCell;
	readonly cellSize: number;
	target?: BoardGridPosition;
}

interface BoardGridDragVisual {
	readonly clientX: number;
	readonly clientY: number;
	readonly source: BoardGridCell;
	readonly cellSize: number;
	readonly targetKey?: string;
}

const positionKeyFn = ({ x, y }: BoardGridPosition) => `${x}:${y}`;

/** Owns modifier-pointer drag admission, global continuation, preview, and completion. */
export const useBoardGridDrag = ({
	gridRef,
	onMoveFn,
}: {
	readonly gridRef: RefObject<HTMLDivElement | null>;
	readonly onMoveFn: (source: BoardGridCell, target: BoardGridPosition) => void;
}) => {
	const dragRef = useRef<BoardGridDrag | undefined>(undefined);
	const dragPreviewRef = useRef<HTMLDivElement>(null);
	const moveFn = useEffectEvent(onMoveFn);
	const suppressClickRef = useRef(false);
	const [dragVisual, setDragVisualFn] = useState<BoardGridDragVisual>();

	useEffect(() => {
		const readTargetFn = (target: EventTarget | null) => {
			if (!(target instanceof Element)) return undefined;
			const cell = target.closest<HTMLElement>("[data-board-grid-cell]");
			if (cell === null || gridRef.current?.contains(cell) !== true) return undefined;
			const x = Number(cell.dataset.x);
			const y = Number(cell.dataset.y);
			return Number.isSafeInteger(x) && Number.isSafeInteger(y)
				? {
						x,
						y,
					}
				: undefined;
		};
		const resetFn = () => {
			dragRef.current = undefined;
			setDragVisualFn(undefined);
		};
		const suppressNextClickFn = () => {
			suppressClickRef.current = true;
			window.setTimeout(() => {
				suppressClickRef.current = false;
			}, 0);
		};
		const onPointerMoveFn = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (drag === undefined || event.pointerId !== drag.pointerId) return;
			event.preventDefault();
			if (
				drag.phase === "pressed" &&
				Math.hypot(event.clientX - drag.pressX, event.clientY - drag.pressY) <
					PointerDragThreshold
			)
				return;
			const target = readTargetFn(event.target);
			const targetKey = target === undefined ? undefined : positionKeyFn(target);
			drag.target = target;
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				setDragVisualFn({
					clientX: event.clientX,
					clientY: event.clientY,
					source: drag.source,
					cellSize: drag.cellSize,
					targetKey,
				});
			} else {
				setDragVisualFn((current) =>
					current === undefined
						? current
						: {
								...current,
								clientX: event.clientX,
								clientY: event.clientY,
								targetKey,
							},
				);
			}
			if (dragPreviewRef.current !== null)
				dragPreviewRef.current.style.transform = `translate3d(${event.clientX + 12}px, ${event.clientY + 12}px, 0)`;
		};
		const finishFn = (event: PointerEvent, commit: boolean) => {
			const drag = dragRef.current;
			if (drag === undefined || event.pointerId !== drag.pointerId) return;
			if (drag.phase === "dragging") {
				event.preventDefault();
				const target = readTargetFn(event.target);
				if (
					commit &&
					target !== undefined &&
					(target.x !== drag.source.x || target.y !== drag.source.y)
				)
					moveFn(drag.source, target);
			}
			suppressNextClickFn();
			resetFn();
		};
		const onPointerUpFn = (event: PointerEvent) => finishFn(event, true);
		const onPointerCancelFn = (event: PointerEvent) => finishFn(event, false);
		window.addEventListener("pointermove", onPointerMoveFn);
		window.addEventListener("pointerup", onPointerUpFn);
		window.addEventListener("pointercancel", onPointerCancelFn);
		window.addEventListener("blur", resetFn);
		return () => {
			window.removeEventListener("pointermove", onPointerMoveFn);
			window.removeEventListener("pointerup", onPointerUpFn);
			window.removeEventListener("pointercancel", onPointerCancelFn);
			window.removeEventListener("blur", resetFn);
		};
	}, [
		gridRef,
	]);

	const startDragFn = (event: ReactPointerEvent<HTMLButtonElement>, source: BoardGridCell) => {
		if (event.button !== 0 || (!event.altKey && !event.metaKey)) return;
		event.preventDefault();
		dragRef.current = {
			phase: "pressed",
			pointerId: event.pointerId,
			pressX: event.clientX,
			pressY: event.clientY,
			source,
			cellSize: event.currentTarget.getBoundingClientRect().width,
		};
	};

	return {
		dragPreviewRef,
		dragVisual,
		startDragFn,
		suppressClickRef,
	};
};
