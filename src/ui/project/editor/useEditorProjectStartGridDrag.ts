import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import { PointerDragThreshold } from "~/ui/drag/PointerDragThreshold";
import type {
	EditorProjectStartGridCell,
	EditorProjectStartGridPosition,
} from "~/ui/project/editor/EditorProjectStartGridCell";

interface EditorProjectStartGridDrag {
	phase: "dragging" | "pressed";
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly source: EditorProjectStartGridCell;
	target?: EditorProjectStartGridPosition;
}

export interface EditorProjectStartGridDragVisual {
	readonly clientX: number;
	readonly clientY: number;
	readonly source: EditorProjectStartGridCell;
	readonly targetKey?: string;
}

const positionKey = ({ x, y }: EditorProjectStartGridPosition) => `${x}:${y}`;

/** Owns modifier-pointer drag admission, global continuation, preview, and completion. */
export const useEditorProjectStartGridDrag = ({
	gridRef,
	onMove,
}: {
	readonly gridRef: RefObject<HTMLDivElement | null>;
	readonly onMove: (
		source: EditorProjectStartGridCell,
		target: EditorProjectStartGridPosition,
	) => void;
}) => {
	const dragRef = useRef<EditorProjectStartGridDrag | undefined>(undefined);
	const dragPreviewRef = useRef<HTMLDivElement>(null);
	const onMoveRef = useRef(onMove);
	onMoveRef.current = onMove;
	const suppressClickRef = useRef(false);
	const [dragVisual, setDragVisual] = useState<EditorProjectStartGridDragVisual>();

	useEffect(() => {
		const readTarget = (target: EventTarget | null) => {
			if (!(target instanceof Element)) return undefined;
			const cell = target.closest<HTMLElement>("[data-start-grid-cell]");
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
		const reset = () => {
			dragRef.current = undefined;
			setDragVisual(undefined);
		};
		const suppressNextClick = () => {
			suppressClickRef.current = true;
			window.setTimeout(() => {
				suppressClickRef.current = false;
			}, 0);
		};
		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (drag === undefined || event.pointerId !== drag.pointerId) return;
			event.preventDefault();
			if (
				drag.phase === "pressed" &&
				Math.hypot(event.clientX - drag.pressX, event.clientY - drag.pressY) <
					PointerDragThreshold
			)
				return;
			const target = readTarget(event.target);
			const targetKey = target === undefined ? undefined : positionKey(target);
			drag.target = target;
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				setDragVisual({
					clientX: event.clientX,
					clientY: event.clientY,
					source: drag.source,
					targetKey,
				});
			} else {
				setDragVisual((current) =>
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
		const finish = (event: PointerEvent, commit: boolean) => {
			const drag = dragRef.current;
			if (drag === undefined || event.pointerId !== drag.pointerId) return;
			if (drag.phase === "dragging") {
				event.preventDefault();
				const target = readTarget(event.target) ?? drag.target;
				if (
					commit &&
					target !== undefined &&
					(target.x !== drag.source.x || target.y !== drag.source.y)
				)
					onMoveRef.current(drag.source, target);
			}
			suppressNextClick();
			reset();
		};
		const onPointerUp = (event: PointerEvent) => finish(event, true);
		const onPointerCancel = (event: PointerEvent) => finish(event, false);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("blur", reset);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("blur", reset);
		};
	}, [
		gridRef,
	]);

	const startDrag = (
		event: ReactPointerEvent<HTMLButtonElement>,
		source: EditorProjectStartGridCell,
	) => {
		if (event.button !== 0 || (!event.altKey && !event.metaKey)) return;
		event.preventDefault();
		dragRef.current = {
			phase: "pressed",
			pointerId: event.pointerId,
			pressX: event.clientX,
			pressY: event.clientY,
			source,
		};
	};

	return {
		dragPreviewRef,
		dragVisual,
		startDrag,
		suppressClickRef,
	};
};
