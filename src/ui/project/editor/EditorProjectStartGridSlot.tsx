import { type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { twMerge } from "tailwind-merge";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import type {
	EditorProjectStartGridCell,
	EditorProjectStartGridPosition,
} from "~/ui/project/editor/EditorProjectStartGridCell";

/** Renders and owns keyboard/pointer gestures for one concrete starting-grid slot. */
export const EditorProjectStartGridSlot = ({
	cell,
	full,
	isDragSource,
	isDragTarget,
	itemResourceIds,
	itemTitle,
	onDecrement,
	onDelete,
	onIncrement,
	onMove,
	onOpen,
	position,
	scope,
	startDrag,
	suppressClickRef,
}: {
	readonly cell: EditorProjectStartGridCell | undefined;
	readonly full: boolean;
	readonly isDragSource: boolean;
	readonly isDragTarget: boolean;
	readonly itemResourceIds: EditorItemThumbnail.Props["resourceIds"] | undefined;
	readonly itemTitle: string | undefined;
	readonly onDecrement: () => void;
	readonly onDelete: () => void;
	readonly onIncrement: () => void;
	readonly onMove: (offset: EditorProjectStartGridPosition) => void;
	readonly onOpen: () => void;
	readonly position: EditorProjectStartGridPosition;
	readonly scope: EditorProjectStartScope;
	readonly startDrag: (
		event: ReactPointerEvent<HTMLButtonElement>,
		source: EditorProjectStartGridCell,
	) => void;
	readonly suppressClickRef: RefObject<boolean>;
}) => (
	<button
		aria-label={
			cell === undefined
				? `Empty ${scope} slot ${position.x + 1}, ${position.y + 1}`
				: `${itemTitle ?? cell.itemId}, quantity ${cell.quantity}`
		}
		className={twMerge(
			"relative grid size-[4.5rem] cursor-pointer place-items-center rounded-lg border border-line bg-surface/70 text-subtle transition-[background-color,border-color,opacity,box-shadow] hover:border-line-strong hover:bg-surface-raised",
			isDragSource && "opacity-30",
			isDragTarget && "border-accent ring-2 ring-accent/60 ring-offset-1 ring-offset-canvas",
		)}
		data-start-grid-cell="true"
		data-x={position.x}
		data-y={position.y}
		onClick={(event) => {
			if (suppressClickRef.current || event.altKey || event.metaKey) return;
			if (cell === undefined) onOpen();
			else if (!full) onIncrement();
		}}
		onContextMenu={(event) => {
			event.preventDefault();
			if (cell !== undefined) onDecrement();
		}}
		onKeyDown={(event) => {
			if (cell === undefined) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				onDelete();
				return;
			}
			if (event.key === "-" || event.key === "_") {
				event.preventDefault();
				onDecrement();
				return;
			}
			if (!event.altKey && !event.metaKey) return;
			const offset =
				event.key === "ArrowLeft"
					? {
							x: -1,
							y: 0,
						}
					: event.key === "ArrowRight"
						? {
								x: 1,
								y: 0,
							}
						: event.key === "ArrowUp"
							? {
									x: 0,
									y: -1,
								}
							: event.key === "ArrowDown"
								? {
										x: 0,
										y: 1,
									}
								: undefined;
			if (offset === undefined) return;
			event.preventDefault();
			onMove(offset);
		}}
		onPointerDown={(event) => {
			if (cell !== undefined) startDrag(event, cell);
		}}
		type="button"
	>
		{itemResourceIds === undefined ? (
			<span className="icon-[lucide--plus] size-4 opacity-35" />
		) : (
			<EditorItemThumbnail
				className="size-14 border-0 bg-transparent"
				resourceIds={itemResourceIds}
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
