import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { PointerDragThreshold } from "~/ui/drag/PointerDragThreshold";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { EditorProjectStartItemPicker } from "~/ui/project/editor/EditorProjectStartItemPicker";

export interface EditorProjectStartGridCell {
	readonly itemId: string;
	readonly quantity: number;
	readonly x: number;
	readonly y: number;
}

interface EditorProjectStartGridPosition {
	readonly x: number;
	readonly y: number;
}

interface EditorProjectStartGridProps {
	readonly cells: ReadonlyArray<EditorProjectStartGridCell>;
	readonly height: number;
	readonly onDecrement: (x: number, y: number) => void;
	readonly onIncrement: (x: number, y: number) => void;
	readonly onMove: (sourceX: number, sourceY: number, targetX: number, targetY: number) => void;
	readonly onSet: (x: number, y: number, itemId: string) => void;
	readonly scope: EditorProjectStartScope;
	readonly width: number;
}

interface EditorProjectStartGridDrag {
	phase: "dragging" | "pressed";
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly source: EditorProjectStartGridCell;
	target?: EditorProjectStartGridPosition;
}

interface EditorProjectStartGridDragVisual {
	readonly clientX: number;
	readonly clientY: number;
	readonly source: EditorProjectStartGridCell;
	readonly targetKey?: string;
}

const positionKey = ({ x, y }: EditorProjectStartGridPosition) => `${x}:${y}`;

/** Edits exact starting stacks on one Board/Toolbar/Inventory grid without changing layout ownership. */
export const EditorProjectStartGrid = ({
	cells,
	height,
	onDecrement,
	onIncrement,
	onMove,
	onSet,
	scope,
	width,
}: EditorProjectStartGridProps) => {
	const { items } = useEditorItemSearchOptions();
	const gridRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<EditorProjectStartGridDrag | undefined>(undefined);
	const dragPreviewRef = useRef<HTMLDivElement>(null);
	const onMoveRef = useRef(onMove);
	onMoveRef.current = onMove;
	const suppressClickRef = useRef(false);
	const [dragVisual, setDragVisual] = useState<EditorProjectStartGridDragVisual>();
	const [pickerCell, setPickerCell] = useState<EditorProjectStartGridPosition>();
	const cellsByPosition = new Map(
		cells.map((cell) => [
			positionKey(cell),
			cell,
		]),
	);
	const positions = Array.from(
		{
			length: Math.max(0, width * height),
		},
		(_, index) => ({
			x: index % Math.max(1, width),
			y: Math.floor(index / Math.max(1, width)),
		}),
	);

	useEffect(() => {
		const readTarget = (
			target: EventTarget | null,
		): EditorProjectStartGridPosition | undefined => {
			if (!(target instanceof Element)) return undefined;
			const cell = target.closest<HTMLElement>("[data-start-grid-cell]");
			if (cell === null || gridRef.current?.contains(cell) !== true) return undefined;
			const x = Number(cell.dataset.x);
			const y = Number(cell.dataset.y);
			if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return undefined;
			return {
				x,
				y,
			};
		};
		const updatePreviewPosition = (clientX: number, clientY: number) => {
			if (dragPreviewRef.current === null) return;
			dragPreviewRef.current.style.transform = `translate3d(${clientX + 12}px, ${clientY + 12}px, 0)`;
		};
		const resetDrag = () => {
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
			const offsetX = event.clientX - drag.pressX;
			const offsetY = event.clientY - drag.pressY;
			if (drag.phase === "pressed" && Math.hypot(offsetX, offsetY) < PointerDragThreshold)
				return;
			const target = readTarget(event.target);
			const targetKey = target === undefined ? undefined : positionKey(target);
			if (drag.phase === "pressed") {
				drag.phase = "dragging";
				drag.target = target;
				setDragVisual({
					clientX: event.clientX,
					clientY: event.clientY,
					source: drag.source,
					targetKey,
				});
			} else if (
				(drag.target === undefined ? undefined : positionKey(drag.target)) !== targetKey
			) {
				drag.target = target;
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
			} else {
				drag.target = target;
			}
			updatePreviewPosition(event.clientX, event.clientY);
		};
		const finishDrag = (event: PointerEvent, commit: boolean) => {
			const drag = dragRef.current;
			if (drag === undefined || event.pointerId !== drag.pointerId) return;
			if (drag.phase === "dragging") {
				event.preventDefault();
				drag.target = readTarget(event.target) ?? drag.target;
				const target = drag.target;
				if (
					commit &&
					target !== undefined &&
					(target.x !== drag.source.x || target.y !== drag.source.y)
				) {
					onMoveRef.current(drag.source.x, drag.source.y, target.x, target.y);
				}
			}
			suppressNextClick();
			resetDrag();
		};
		const onPointerUp = (event: PointerEvent) => finishDrag(event, true);
		const onPointerCancel = (event: PointerEvent) => finishDrag(event, false);
		const onBlur = () => resetDrag();
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("blur", onBlur);
		};
	}, []);

	return (
		<>
			<div className="max-w-full overflow-auto rounded-xl border border-line bg-canvas/50 p-3">
				<div
					className="grid w-max gap-1.5"
					ref={gridRef}
					style={{
						gridTemplateColumns: `repeat(${Math.max(1, width)}, 4.5rem)`,
					}}
				>
					{positions.map(({ x, y }) => {
						const key = positionKey({
							x,
							y,
						});
						const cell = cellsByPosition.get(key);
						const item = cell === undefined ? undefined : items[cell.itemId];
						const full =
							cell !== undefined &&
							item !== undefined &&
							cell.quantity >= item.maxStackSize;
						const isDragSource =
							dragVisual !== undefined &&
							dragVisual.source.x === x &&
							dragVisual.source.y === y;
						const isDragTarget = dragVisual?.targetKey === key;
						return (
							<button
								aria-label={
									cell === undefined
										? `Empty ${scope} slot ${x + 1}, ${y + 1}`
										: `${item?.title ?? cell.itemId}, quantity ${cell.quantity}`
								}
								className={twMerge(
									"relative grid size-[4.5rem] cursor-pointer place-items-center rounded-lg border border-line bg-surface/70 text-subtle transition-[background-color,border-color,opacity,box-shadow] hover:border-line-strong hover:bg-surface-raised",
									isDragSource && "opacity-30",
									isDragTarget &&
										"border-accent ring-2 ring-accent/60 ring-offset-1 ring-offset-canvas",
								)}
								data-start-grid-cell="true"
								data-x={x}
								data-y={y}
								key={key}
								onClick={(event) => {
									if (suppressClickRef.current || event.altKey || event.metaKey)
										return;
									if (cell === undefined)
										setPickerCell({
											x,
											y,
										});
									else if (!full) onIncrement(x, y);
								}}
								onContextMenu={(event) => {
									event.preventDefault();
									if (cell !== undefined) onDecrement(x, y);
								}}
								onPointerDown={(event) => {
									if (
										cell === undefined ||
										event.button !== 0 ||
										(!event.altKey && !event.metaKey)
									)
										return;
									event.preventDefault();
									dragRef.current = {
										phase: "pressed",
										pointerId: event.pointerId,
										pressX: event.clientX,
										pressY: event.clientY,
										source: cell,
									};
								}}
								type="button"
							>
								{item === undefined ? (
									<span className="icon-[lucide--plus] size-4 opacity-35" />
								) : (
									<EditorItemThumbnail
										className="size-14 border-0 bg-transparent"
										resourceIds={item.asset.default}
										size="sm"
									/>
								)}
								{cell === undefined ? null : (
									<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
										×{cell.quantity}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
			<p className="text-xs text-muted">
				Left click an empty slot to choose an item, left click a stack to add one, right
				click to remove one. Hold Alt or Cmd and drag a stack to move it; dropping on an
				occupied slot replaces it.
			</p>
			{pickerCell === undefined ? null : (
				<EditorProjectStartItemPicker
					onClose={() => setPickerCell(undefined)}
					onSelect={(itemId) => onSet(pickerCell.x, pickerCell.y, itemId)}
					scope={scope}
				/>
			)}
			{dragVisual === undefined ? null : (
				<div
					className="pointer-events-none fixed top-0 left-0 z-[90] grid size-[4.5rem] place-items-center rounded-lg border border-accent bg-surface-raised/95 text-foreground shadow-2xl"
					data-ui="EditorProjectStartGridDragPreview"
					ref={dragPreviewRef}
					style={{
						transform: `translate3d(${dragVisual.clientX + 12}px, ${dragVisual.clientY + 12}px, 0)`,
					}}
				>
					<EditorItemThumbnail
						className="size-14 border-0 bg-transparent"
						resourceIds={items[dragVisual.source.itemId]?.asset.default ?? []}
						size="sm"
					/>
					<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
						×{dragVisual.source.quantity}
					</span>
				</div>
			)}
		</>
	);
};
