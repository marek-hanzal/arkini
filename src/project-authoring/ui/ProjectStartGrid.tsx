import { useRef, useState, type RefObject } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { ProjectStartItemPicker } from "~/project-authoring/ui/ProjectStartItemPicker";
import type {
	ProjectStartGridCell,
	ProjectStartGridPosition,
} from "~/project-authoring/type/ProjectStartGridCell";
import { ProjectStartGridSlot } from "~/project-authoring/ui/ProjectStartGridSlot";
import { useProjectStartGridDrag } from "~/project-authoring/ui/useProjectStartGridDrag";

interface ProjectStartGridProps {
	readonly cells: ReadonlyArray<ProjectStartGridCell>;
	readonly height: number;
	readonly onCellsChangeFn: (cells: ReadonlyArray<ProjectStartGridCell>) => void;
	readonly scope: ProjectStartScope;
	readonly width: number;
}

const positionKeyFn = ({ x, y }: ProjectStartGridPosition) => `${x}:${y}`;

const moveCellFn = (
	cells: ReadonlyArray<ProjectStartGridCell>,
	source: ProjectStartGridCell,
	target: ProjectStartGridPosition,
) => [
	...cells.filter(
		({ x, y }) => (x !== source.x || y !== source.y) && (x !== target.x || y !== target.y),
	),
	{
		...source,
		...target,
	},
];

const ProjectStartGridDragPreview = ({
	clientX,
	clientY,
	quantity,
	resourceIds,
	previewRef,
}: {
	readonly clientX: number;
	readonly clientY: number;
	readonly previewRef: RefObject<HTMLDivElement | null>;
	readonly quantity: number;
	readonly resourceIds: ItemSchema.Type["asset"]["default"];
}) => (
	<div
		className="pointer-events-none fixed top-0 left-0 z-[90] grid size-[4.5rem] place-items-center rounded-lg border border-accent bg-surface-raised/95 text-foreground shadow-2xl"
		data-ui="EditorProjectStartGridDragPreview"
		ref={previewRef}
		style={{
			transform: `translate3d(${clientX + 12}px, ${clientY + 12}px, 0)`,
		}}
	>
		<EditorItemThumbnail
			className="size-14 border-0 bg-transparent"
			resourceIds={resourceIds}
			size="sm"
		/>
		<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
			×{quantity}
		</span>
	</div>
);

/** Edits exact starting stacks on one Board/Toolbar/Inventory grid without changing layout ownership. */
export const ProjectStartGrid = ({
	cells,
	height,
	onCellsChangeFn,
	scope,
	width,
}: ProjectStartGridProps) => {
	const { items } = useEditorItemSearchOptions();
	const gridRef = useRef<HTMLDivElement>(null);
	const [pickerCell, setPickerCellFn] = useState<ProjectStartGridPosition>();
	const { dragPreviewRef, dragVisual, startDragFn, suppressClickRef } = useProjectStartGridDrag({
		gridRef,
		onMoveFn: (source, target) => onCellsChangeFn(moveCellFn(cells, source, target)),
	});
	const cellsByPosition = new Map(
		cells.map((cell) => [
			positionKeyFn(cell),
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
	const changeCellFn = (
		position: ProjectStartGridPosition,
		changeFn: (cell: ProjectStartGridCell | undefined) => ProjectStartGridCell | undefined,
	) => {
		const index = cells.findIndex(({ x, y }) => x === position.x && y === position.y);
		const current = cells[index];
		const next = changeFn(current);
		if (next === current) return;
		onCellsChangeFn(
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
	const incrementFn = (position: ProjectStartGridPosition) =>
		changeCellFn(position, (cell) => {
			if (cell === undefined) return cell;
			const maxStackSize = items[cell.itemId]?.maxStackSize ?? 1;
			return cell.quantity >= maxStackSize
				? cell
				: {
						...cell,
						quantity: cell.quantity + 1,
					};
		});
	const decrementFn = (position: ProjectStartGridPosition) =>
		changeCellFn(position, (cell) =>
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
					className="mx-auto grid w-max gap-1.5"
					ref={gridRef}
					style={{
						gridTemplateColumns: `repeat(${Math.max(1, width)}, 4.5rem)`,
					}}
				>
					{positions.map(({ x, y }) => {
						const key = positionKeyFn({
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
							<ProjectStartGridSlot
								cell={cell}
								full={full}
								isDragSource={isDragSource}
								isDragTarget={isDragTarget}
								itemResourceIds={item?.asset.default}
								key={key}
								onDecrementFn={() =>
									decrementFn({
										x,
										y,
									})
								}
								onDeleteFn={() =>
									changeCellFn(
										{
											x,
											y,
										},
										() => undefined,
									)
								}
								onIncrementFn={() =>
									incrementFn({
										x,
										y,
									})
								}
								onMoveFn={(offset) => {
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
									onCellsChangeFn(moveCellFn(cells, cell, target));
								}}
								onOpenFn={() =>
									setPickerCellFn({
										x,
										y,
									})
								}
								position={{
									x,
									y,
								}}
								startDragFn={startDragFn}
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
				<ProjectStartItemPicker
					onCloseFn={() => setPickerCellFn(undefined)}
					onSelectFn={(itemId) =>
						changeCellFn(pickerCell, () => ({
							itemId,
							quantity: 1,
							...pickerCell,
						}))
					}
					scope={scope}
				/>
			)}
			{dragVisual === undefined ? null : (
				<ProjectStartGridDragPreview
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
