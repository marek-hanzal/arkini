import "./BoardGrid.css";
import { Plus } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
	useRef,
	useState,
} from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { BoardItemPicker } from "~/board-authoring/ui/BoardItemPicker";
import type { BoardGridCell, BoardGridPosition } from "~/board-authoring/type/BoardGridCell";
import { useBoardGridDrag } from "~/board-authoring/ui/useBoardGridDrag";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ButtonLink } from "~/ui/ui/Button";

interface BoardGridCommonProps {
	readonly cells: ReadonlyArray<BoardGridCell>;
	readonly height: number;
	readonly width: number;
}

interface BoardGridDetailProps extends BoardGridCommonProps {
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly mode: "detail";
	readonly projectId: string;
}

interface BoardGridEditProps extends BoardGridCommonProps {
	readonly invalidCells?: ReadonlyArray<BoardGridPosition>;
	readonly mode: "edit";
	readonly onCellsChangeFn: (cells: ReadonlyArray<BoardGridCell>) => void;
}

type BoardGridProps = BoardGridDetailProps | BoardGridEditProps;

const positionKeyFn = ({ x, y }: BoardGridPosition) => `${x}:${y}`;

const moveCellFn = (
	cells: ReadonlyArray<BoardGridCell>,
	source: BoardGridCell,
	target: BoardGridPosition,
) => [
	...cells.filter(
		({ x, y }) => (x !== source.x || y !== source.y) && (x !== target.x || y !== target.y),
	),
	{
		...source,
		...target,
	},
];

const BoardGridCellContent = ({
	empty,
	resourceIds,
}: {
	readonly empty?: ReactNode;
	readonly resourceIds: ItemSchema.Type["artwork"]["default"] | undefined;
}) => (
	<>
		{resourceIds === undefined ? (
			empty
		) : (
			<EditorItemThumbnail
				className="absolute inset-[11%] size-[78%] border-0 bg-transparent"
				resourceIds={resourceIds}
				size="sm"
			/>
		)}
	</>
);

const BoardGridSlot = ({
	cell,
	isDragSource,
	isDragTarget,
	invalid,
	item,
	onDeleteFn,
	onMoveFn,
	onOpenFn,
	position,
	startDragFn,
	suppressClickRef,
}: {
	readonly cell: BoardGridCell | undefined;
	readonly isDragSource: boolean;
	readonly isDragTarget: boolean;
	readonly invalid: boolean;
	readonly item: ItemSchema.Type | undefined;
	readonly onDeleteFn: () => void;
	readonly onMoveFn: (offset: BoardGridPosition) => void;
	readonly onOpenFn: () => void;
	readonly position: BoardGridPosition;
	readonly startDragFn: (
		event: ReactPointerEvent<HTMLButtonElement>,
		source: BoardGridCell,
	) => void;
	readonly suppressClickRef: RefObject<boolean>;
}) => (
	<button
		className="relative grid aspect-square w-full min-w-0 min-h-0 [container-type:inline-size] place-items-center border-0 bg-transparent p-0 text-subtle inset-ring-0 transition-[background-color,border-color,opacity,box-shadow] enabled:cursor-pointer enabled:hover:shadow-[inset_0_0_0_1px_var(--ak-accent)] data-[ui-drag-source=true]:opacity-30 data-[ui-drag-target=true]:inset-ring-2 data-[ui-drag-target=true]:inset-ring-accent/60 data-[ui-invalid=true]:inset-ring-2 data-[ui-invalid=true]:inset-ring-danger/35"
		data-board-grid-cell="true"
		data-x={position.x}
		data-y={position.y}
		title={item?.title || item?.uid}
		type="button"
		{...readDataUiFn({
			dataUi: "EditorBoardGridSlot",
			state: {
				dragSource: isDragSource,
				dragTarget: isDragTarget,
				invalid,
				alternate: (position.x + position.y) % 2 === 1,
			},
		})}
		onClick={(event) => {
			if (suppressClickRef.current || event.altKey || event.metaKey) return;
			onOpenFn();
		}}
		onContextMenu={(event) => {
			event.preventDefault();
			if (cell !== undefined) onDeleteFn();
		}}
		onKeyDown={(event) => {
			if (cell === undefined) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				onDeleteFn();
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
			onMoveFn(offset);
		}}
		onPointerDown={(event) => {
			if (cell !== undefined) startDragFn(event, cell);
		}}
	>
		<BoardGridCellContent
			empty={<Plus className="size-[15%] opacity-35" />}
			resourceIds={item?.artwork.default}
		/>
	</button>
);

const BoardGridSurface = ({
	cells,
	edit,
	height,
	items,
	projectId,
	width,
}: BoardGridCommonProps & {
	readonly edit?: {
		readonly dragVisual?: {
			readonly source: BoardGridCell;
			readonly targetKey?: string;
		};
		readonly gridRef: RefObject<HTMLDivElement | null>;
		readonly invalidPositionKeys: ReadonlySet<string>;
		readonly onDeleteFn: (position: BoardGridPosition) => void;
		readonly onMoveFn: (cell: BoardGridCell, offset: BoardGridPosition) => void;
		readonly onOpenFn: (position: BoardGridPosition) => void;
		readonly startDragFn: (
			event: ReactPointerEvent<HTMLButtonElement>,
			source: BoardGridCell,
		) => void;
		readonly suppressClickRef: RefObject<boolean>;
	};
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly projectId?: string;
}) => {
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
	return (
		<div
			className="min-w-0 max-w-full overflow-x-auto"
			data-ui="EditorBoardGrid"
			data-mode={edit === undefined ? "detail" : "edit"}
		>
			<div
				className="mx-auto grid overflow-hidden border border-line bg-surface/78"
				data-ui="EditorBoardGridSurface"
				ref={edit?.gridRef}
				style={{
					gridTemplateColumns: `repeat(${Math.max(1, width)}, minmax(0, 1fr))`,
					// Fit square cells to the panel width and a viewport-bounded preview height.
					width: `min(100%, calc(70dvh / ${Math.max(1, height)} * ${Math.max(1, width)}))`,
					// Gameplay rounds the outer board by 16 px per 512 px world cell.
					borderRadius: `${100 / (32 * Math.max(1, width))}% / ${100 / (32 * Math.max(1, height))}%`,
				}}
			>
				{positions.map((position) => {
					const key = positionKeyFn(position);
					const cell = cellsByPosition.get(key);
					const item = cell === undefined ? undefined : items[cell.itemUid];
					if (edit === undefined) {
						const className =
							"relative grid aspect-square w-full min-w-0 min-h-0 [container-type:inline-size] place-items-center border-0 bg-transparent p-0 text-subtle shadow-none";
						const content = (
							<BoardGridCellContent resourceIds={item?.artwork.default} />
						);
						return cell !== undefined &&
							item !== undefined &&
							projectId !== undefined ? (
							<ButtonLink
								className={`${className} hover:shadow-[inset_0_0_0_1px_var(--ak-accent)]`}
								data-item-uid={item.uid}
								{...readDataUiFn({
									dataUi: "EditorBoardGridSlot",
									state: {
										alternate: (position.x + position.y) % 2 === 1,
									},
								})}
								key={key}
								params={{
									itemUid: item.uid,
									projectId,
									sectionId: "identity",
								}}
								title={item.title || item.uid}
								to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
							>
								{content}
							</ButtonLink>
						) : (
							<div
								className={className}
								{...readDataUiFn({
									dataUi: "EditorBoardGridSlot",
									state: {
										alternate: (position.x + position.y) % 2 === 1,
									},
								})}
								key={key}
								title={item?.title || item?.uid}
							>
								{content}
							</div>
						);
					}
					const isDragSource =
						edit.dragVisual !== undefined &&
						edit.dragVisual.source.x === position.x &&
						edit.dragVisual.source.y === position.y;
					return (
						<BoardGridSlot
							cell={cell}
							isDragSource={isDragSource}
							isDragTarget={edit.dragVisual?.targetKey === key}
							invalid={edit.invalidPositionKeys.has(key)}
							item={item}
							key={key}
							onDeleteFn={() => edit.onDeleteFn(position)}
							onMoveFn={(offset) => {
								if (cell !== undefined) edit.onMoveFn(cell, offset);
							}}
							onOpenFn={() => edit.onOpenFn(position)}
							position={position}
							startDragFn={edit.startDragFn}
							suppressClickRef={edit.suppressClickRef}
						/>
					);
				})}
			</div>
		</div>
	);
};

const BoardGridDragPreview = ({
	clientX,
	clientY,
	cellSize,
	resourceIds,
	previewRef,
}: {
	readonly clientX: number;
	readonly clientY: number;
	readonly cellSize: number;
	readonly previewRef: RefObject<HTMLDivElement | null>;
	readonly resourceIds: ItemSchema.Type["artwork"]["default"];
}) => (
	<div
		className="pointer-events-none fixed top-0 left-0 z-[90] grid [container-type:inline-size] place-items-center rounded-lg border border-accent bg-surface-raised/95 text-foreground shadow-2xl"
		data-ui="EditorBoardGridDragPreview"
		ref={previewRef}
		style={{
			transform: `translate3d(${clientX + 12}px, ${clientY + 12}px, 0)`,
			width: cellSize,
			height: cellSize,
		}}
	>
		<BoardGridCellContent resourceIds={resourceIds} />
	</div>
);

const BoardGridEdit = ({
	cells,
	height,
	invalidCells = [],
	onCellsChangeFn,
	width,
}: BoardGridEditProps) => {
	const { items } = useEditorItemSearchOptions();
	const gridRef = useRef<HTMLDivElement>(null);
	const [pickerCell, setPickerCellFn] = useState<BoardGridPosition>();
	const invalidPositionKeys = new Set(invalidCells.map(positionKeyFn));
	const { dragPreviewRef, dragVisual, startDragFn, suppressClickRef } = useBoardGridDrag({
		gridRef,
		onMoveFn: (source, target) => onCellsChangeFn(moveCellFn(cells, source, target)),
	});
	const changeCellFn = (
		position: BoardGridPosition,
		changeFn: (cell: BoardGridCell | undefined) => BoardGridCell | undefined,
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

	return (
		<>
			<BoardGridSurface
				cells={cells}
				edit={{
					dragVisual,
					gridRef,
					invalidPositionKeys,
					onDeleteFn: (position) => changeCellFn(position, () => undefined),
					onMoveFn: (cell, offset) => {
						const target = {
							x: cell.x + offset.x,
							y: cell.y + offset.y,
						};
						if (target.x < 0 || target.x >= width || target.y < 0 || target.y >= height)
							return;
						onCellsChangeFn(moveCellFn(cells, cell, target));
					},
					onOpenFn: setPickerCellFn,
					startDragFn,
					suppressClickRef,
				}}
				height={height}
				items={items}
				width={width}
			/>
			{pickerCell === undefined ? null : (
				<BoardItemPicker
					onCloseFn={() => setPickerCellFn(undefined)}
					onSelectFn={(itemUid) =>
						changeCellFn(pickerCell, () => ({
							itemUid,
							...pickerCell,
						}))
					}
				/>
			)}
			{dragVisual === undefined ? null : (
				<BoardGridDragPreview
					clientX={dragVisual.clientX}
					clientY={dragVisual.clientY}
					cellSize={dragVisual.cellSize}
					previewRef={dragPreviewRef}
					resourceIds={items[dragVisual.source.itemUid]?.artwork.default ?? []}
				/>
			)}
		</>
	);
};

/** Presents one authored board and adds editing gestures only in edit mode. */
export const BoardGrid = (props: BoardGridProps) =>
	props.mode === "detail" ? <BoardGridSurface {...props} /> : <BoardGridEdit {...props} />;
