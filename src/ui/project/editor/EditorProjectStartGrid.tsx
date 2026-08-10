import { useRef, useState } from "react";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { EditorProjectStartGridDragPreview } from "~/ui/project/editor/EditorProjectStartGridDragPreview";
import { EditorProjectStartItemPicker } from "~/ui/project/editor/EditorProjectStartItemPicker";
import type {
	EditorProjectStartGridCell,
	EditorProjectStartGridPosition,
} from "~/ui/project/editor/EditorProjectStartGridCell";
import { EditorProjectStartGridSlot } from "~/ui/project/editor/EditorProjectStartGridSlot";
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
							<EditorProjectStartGridSlot
								cell={cell}
								full={full}
								isDragSource={isDragSource}
								isDragTarget={isDragTarget}
								itemResourceIds={item?.asset.default}
								itemTitle={item?.title}
								key={key}
								onDecrement={() =>
									decrement({
										x,
										y,
									})
								}
								onDelete={() =>
									changeCell(
										{
											x,
											y,
										},
										() => undefined,
									)
								}
								onIncrement={() =>
									increment({
										x,
										y,
									})
								}
								onMove={(offset) => {
									if (cell === undefined) return;
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
									onCellsChange(moveCell(cells, cell, target));
								}}
								onOpen={() =>
									setPickerCell({
										x,
										y,
									})
								}
								position={{
									x,
									y,
								}}
								scope={scope}
								startDrag={startDrag}
								suppressClickRef={suppressClickRef}
							/>
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
				<EditorProjectStartGridDragPreview
					clientX={dragVisual.clientX}
					clientY={dragVisual.clientY}
					previewRef={dragPreviewRef}
					quantity={dragVisual.source.quantity}
					resourceIds={items[dragVisual.source.itemId]?.asset.default ?? []}
				/>
			)}
		</>
	);
};
