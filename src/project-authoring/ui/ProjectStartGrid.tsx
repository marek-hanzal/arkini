import { Plus } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
	useRef,
	useState,
} from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";
import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { ProjectStartItemPicker } from "~/project-authoring/ui/ProjectStartItemPicker";
import type {
	ProjectStartGridCell,
	ProjectStartGridPosition,
} from "~/project-authoring/type/ProjectStartGridCell";
import { useProjectStartGridDrag } from "~/project-authoring/ui/useProjectStartGridDrag";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ButtonLink } from "~/ui/ui/Button";

interface ProjectStartGridCommonProps {
	readonly cells: ReadonlyArray<ProjectStartGridCell>;
	readonly height: number;
	readonly width: number;
}

interface ProjectStartGridDetailProps extends ProjectStartGridCommonProps {
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly mode: "detail";
	readonly projectId: string;
}

interface ProjectStartGridEditProps extends ProjectStartGridCommonProps {
	readonly invalidCells?: ReadonlyArray<ProjectStartGridPosition>;
	readonly mode: "edit";
	readonly onCellsChangeFn: (cells: ReadonlyArray<ProjectStartGridCell>) => void;
	readonly scope: ProjectStartScope;
	readonly start: StartSchema.Type;
}

type ProjectStartGridProps = ProjectStartGridDetailProps | ProjectStartGridEditProps;

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

const ProjectStartGridCellContent = ({
	empty,
	quantity,
	resourceIds,
}: {
	readonly empty?: ReactNode;
	readonly quantity?: number;
	readonly resourceIds: ItemSchema.Type["asset"]["default"] | undefined;
}) => (
	<>
		{resourceIds === undefined ? (
			empty
		) : (
			<EditorItemThumbnail
				className="size-14 border-0 bg-transparent"
				resourceIds={resourceIds}
				size="sm"
			/>
		)}
		{quantity === undefined ? null : (
			<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
				×{quantity}
			</span>
		)}
	</>
);

const ProjectStartGridSlot = ({
	cell,
	full,
	isDragSource,
	isDragTarget,
	invalid,
	item,
	onDecrementFn,
	onDeleteFn,
	onIncrementFn,
	onMoveFn,
	onOpenFn,
	position,
	startDragFn,
	suppressClickRef,
}: {
	readonly cell: ProjectStartGridCell | undefined;
	readonly full: boolean;
	readonly isDragSource: boolean;
	readonly isDragTarget: boolean;
	readonly invalid: boolean;
	readonly item: ItemSchema.Type | undefined;
	readonly onDecrementFn: () => void;
	readonly onDeleteFn: () => void;
	readonly onIncrementFn: () => void;
	readonly onMoveFn: (offset: ProjectStartGridPosition) => void;
	readonly onOpenFn: () => void;
	readonly position: ProjectStartGridPosition;
	readonly startDragFn: (
		event: ReactPointerEvent<HTMLButtonElement>,
		source: ProjectStartGridCell,
	) => void;
	readonly suppressClickRef: RefObject<boolean>;
}) => (
	<button
		className="relative grid size-[4.5rem] place-items-center rounded-lg border border-line bg-surface/70 text-subtle transition-[background-color,border-color,opacity,box-shadow] enabled:cursor-pointer enabled:hover:border-line-strong enabled:hover:bg-surface-raised data-[ui-drag-source=true]:opacity-30 data-[ui-drag-target=true]:border-accent data-[ui-drag-target=true]:ring-2 data-[ui-drag-target=true]:ring-accent/60 data-[ui-drag-target=true]:ring-offset-1 data-[ui-drag-target=true]:ring-offset-canvas data-[ui-invalid=true]:border-danger data-[ui-invalid=true]:ring-2 data-[ui-invalid=true]:ring-danger/35"
		data-start-grid-cell="true"
		data-x={position.x}
		data-y={position.y}
		title={item?.title || item?.id}
		type="button"
		{...readDataUiFn({
			dataUi: "EditorProjectStartGridSlot",
			state: {
				dragSource: isDragSource,
				dragTarget: isDragTarget,
				invalid,
			},
		})}
		onClick={(event) => {
			if (suppressClickRef.current || event.altKey || event.metaKey) return;
			if (cell === undefined) onOpenFn();
			else if (!full) onIncrementFn();
		}}
		onContextMenu={(event) => {
			event.preventDefault();
			if (cell !== undefined) onDecrementFn();
		}}
		onKeyDown={(event) => {
			if (cell === undefined) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				onDeleteFn();
				return;
			}
			if (event.key === "-" || event.key === "_") {
				event.preventDefault();
				onDecrementFn();
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
		<ProjectStartGridCellContent
			empty={<Plus className="size-4 opacity-35" />}
			quantity={cell?.quantity}
			resourceIds={item?.asset.default}
		/>
	</button>
);

const ProjectStartGridSurface = ({
	cells,
	edit,
	height,
	items,
	projectId,
	width,
}: ProjectStartGridCommonProps & {
	readonly edit?: {
		readonly dragVisual?: {
			readonly source: ProjectStartGridCell;
			readonly targetKey?: string;
		};
		readonly gridRef: RefObject<HTMLDivElement | null>;
		readonly invalidPositionKeys: ReadonlySet<string>;
		readonly onDecrementFn: (position: ProjectStartGridPosition) => void;
		readonly onDeleteFn: (position: ProjectStartGridPosition) => void;
		readonly onIncrementFn: (position: ProjectStartGridPosition) => void;
		readonly onMoveFn: (cell: ProjectStartGridCell, offset: ProjectStartGridPosition) => void;
		readonly onOpenFn: (position: ProjectStartGridPosition) => void;
		readonly startDragFn: (
			event: ReactPointerEvent<HTMLButtonElement>,
			source: ProjectStartGridCell,
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
			className="max-w-full overflow-auto rounded-xl border border-line bg-canvas/50 p-3"
			data-ui="EditorProjectStartGrid"
			data-mode={edit === undefined ? "detail" : "edit"}
		>
			<div
				className="mx-auto grid w-max gap-1.5"
				ref={edit?.gridRef}
				style={{
					gridTemplateColumns: `repeat(${Math.max(1, width)}, 4.5rem)`,
				}}
			>
				{positions.map((position) => {
					const key = positionKeyFn(position);
					const cell = cellsByPosition.get(key);
					const item = cell === undefined ? undefined : items[cell.itemId];
					if (edit === undefined) {
						const className =
							"relative grid size-[4.5rem] min-h-0 place-items-center rounded-lg border border-line bg-surface/70 p-0 text-subtle shadow-none";
						const content = (
							<ProjectStartGridCellContent
								quantity={cell?.quantity}
								resourceIds={item?.asset.default}
							/>
						);
						return cell !== undefined &&
							item !== undefined &&
							projectId !== undefined ? (
							<ButtonLink
								className={`${className} hover:border-accent`}
								data-item-id={item.id}
								data-ui="EditorProjectStartGridSlot"
								key={key}
								params={{
									itemUid: item.uid,
									projectId,
									sectionId: "identity",
								}}
								title={item.title || item.id}
								to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
							>
								{content}
							</ButtonLink>
						) : (
							<div
								className={className}
								data-ui="EditorProjectStartGridSlot"
								key={key}
								title={item?.title || item?.id}
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
						<ProjectStartGridSlot
							cell={cell}
							full={
								cell !== undefined &&
								item !== undefined &&
								cell.quantity >= item.maxStackSize
							}
							isDragSource={isDragSource}
							isDragTarget={edit.dragVisual?.targetKey === key}
							invalid={edit.invalidPositionKeys.has(key)}
							item={item}
							key={key}
							onDecrementFn={() => edit.onDecrementFn(position)}
							onDeleteFn={() => edit.onDeleteFn(position)}
							onIncrementFn={() => edit.onIncrementFn(position)}
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
		<ProjectStartGridCellContent
			quantity={quantity}
			resourceIds={resourceIds}
		/>
	</div>
);

const ProjectStartGridEdit = ({
	cells,
	height,
	invalidCells = [],
	onCellsChangeFn,
	scope,
	start,
	width,
}: ProjectStartGridEditProps) => {
	const { items } = useEditorItemSearchOptions();
	const gridRef = useRef<HTMLDivElement>(null);
	const [pickerCell, setPickerCellFn] = useState<ProjectStartGridPosition>();
	const invalidPositionKeys = new Set(invalidCells.map(positionKeyFn));
	const { dragPreviewRef, dragVisual, startDragFn, suppressClickRef } = useProjectStartGridDrag({
		gridRef,
		onMoveFn: (source, target) => onCellsChangeFn(moveCellFn(cells, source, target)),
	});
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
			<ProjectStartGridSurface
				cells={cells}
				edit={{
					dragVisual,
					gridRef,
					invalidPositionKeys,
					onDecrementFn: decrementFn,
					onDeleteFn: (position) => changeCellFn(position, () => undefined),
					onIncrementFn: incrementFn,
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
					start={start}
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

/** Presents one canonical starting grid and adds editing gestures only in edit mode. */
export const ProjectStartGrid = (props: ProjectStartGridProps) =>
	props.mode === "detail" ? (
		<ProjectStartGridSurface {...props} />
	) : (
		<ProjectStartGridEdit {...props} />
	);
