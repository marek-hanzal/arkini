import { useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { EditorProjectStartItemPicker } from "~/ui/project/editor/EditorProjectStartItemPicker";
import type {
	EditorProjectStartGridCell,
	EditorProjectStartGridPosition,
} from "~/ui/project/editor/EditorProjectStartGridCell";
import { useEditorProjectStartGridDrag } from "~/ui/project/editor/useEditorProjectStartGridDrag";

interface EditorProjectStartGridProps {
	readonly cells: ReadonlyArray<EditorProjectStartGridCell>;
	readonly height: number;
	readonly onCellsChange: (cells: ReadonlyArray<EditorProjectStartGridCell>) => void;
	readonly scope: EditorProjectStartScope;
	readonly width: number;
}

const positionKey = ({ x, y }: EditorProjectStartGridPosition) => `${x}:${y}`;

const moveCell = (
	cells: ReadonlyArray<EditorProjectStartGridCell>,
	source: EditorProjectStartGridCell,
	target: EditorProjectStartGridPosition,
) => [
	...cells.filter(
		({ x, y }) => (x !== source.x || y !== source.y) && (x !== target.x || y !== target.y),
	),
	{
		...source,
		...target,
	},
];

/** Edits exact starting stacks on one Board/Toolbar/Inventory grid without changing layout ownership. */
export const EditorProjectStartGrid = ({
	cells,
	height,
	onCellsChange,
	scope,
	width,
}: EditorProjectStartGridProps) => {
	const { items } = useEditorItemSearchOptions();
	const gridRef = useRef<HTMLDivElement>(null);
	const [pickerCell, setPickerCell] = useState<EditorProjectStartGridPosition>();
	const { dragPreviewRef, dragVisual, startDrag, suppressClickRef } =
		useEditorProjectStartGridDrag({
			gridRef,
			onMove: (source, target) => onCellsChange(moveCell(cells, source, target)),
		});
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
	const changeCell = (
		position: EditorProjectStartGridPosition,
		change: (
			cell: EditorProjectStartGridCell | undefined,
		) => EditorProjectStartGridCell | undefined,
	) => {
		const index = cells.findIndex(({ x, y }) => x === position.x && y === position.y);
		const current = cells[index];
		const next = change(current);
		if (next === current) return;
		onCellsChange(
			index === -1
				? next === undefined
					? cells
					: [
							...cells,
							next,
						]
				: next === undefined
					? cells.filter((_, candidateIndex) => candidateIndex !== index)
					: cells.map((cell, candidateIndex) => (candidateIndex === index ? next : cell)),
		);
	};
	const increment = (position: EditorProjectStartGridPosition) =>
		changeCell(position, (cell) => {
			if (cell === undefined) return cell;
			const maxStackSize = items[cell.itemId]?.maxStackSize ?? 1;
			return cell.quantity >= maxStackSize
				? cell
				: {
						...cell,
						quantity: cell.quantity + 1,
					};
		});
	const decrement = (position: EditorProjectStartGridPosition) =>
		changeCell(position, (cell) =>
			cell === undefined || cell.quantity <= 1
				? undefined
				: {
						...cell,
						quantity: cell.quantity - 1,
					},
		);

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
									else if (!full)
										increment({
											x,
											y,
										});
								}}
								onContextMenu={(event) => {
									event.preventDefault();
									if (cell !== undefined)
										decrement({
											x,
											y,
										});
								}}
								onKeyDown={(event) => {
									if (cell === undefined) return;
									if (event.key === "Delete" || event.key === "Backspace") {
										event.preventDefault();
										changeCell(
											{
												x,
												y,
											},
											() => undefined,
										);
										return;
									}
									if (event.key === "-" || event.key === "_") {
										event.preventDefault();
										decrement({
											x,
											y,
										});
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
									const target = {
										x: x + offset.x,
										y: y + offset.y,
									};
									if (
										target.x < 0 ||
										target.x >= width ||
										target.y < 0 ||
										target.y >= height
									)
										return;
									event.preventDefault();
									onCellsChange(moveCell(cells, cell, target));
								}}
								onPointerDown={(event) => {
									if (cell !== undefined) startDrag(event, cell);
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
				click to remove one. Hold Alt or Cmd and drag, or use Alt/Cmd + Arrow, to move a
				stack; the destination is replaced. Press Minus to decrement or Delete to remove.
			</p>
			{pickerCell === undefined ? null : (
				<EditorProjectStartItemPicker
					onClose={() => setPickerCell(undefined)}
					onSelect={(itemId) =>
						changeCell(pickerCell, () => ({
							itemId,
							quantity: 1,
							...pickerCell,
						}))
					}
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
