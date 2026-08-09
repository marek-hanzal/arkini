import { useState } from "react";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { EditorProjectStartItemPicker } from "~/ui/project/editor/EditorProjectStartItemPicker";

export interface EditorProjectStartGridCell {
	readonly itemId: string;
	readonly quantity: number;
	readonly x: number;
	readonly y: number;
}

interface EditorProjectStartGridProps {
	readonly cells: ReadonlyArray<EditorProjectStartGridCell>;
	readonly height: number;
	readonly onDecrement: (x: number, y: number) => void;
	readonly onIncrement: (x: number, y: number) => void;
	readonly onSet: (x: number, y: number, itemId: string) => void;
	readonly scope: GridLocationSchema.Type["scope"];
	readonly width: number;
}

/** Edits exact starting stacks on one Board/Toolbar/Inventory grid without changing layout ownership. */
export const EditorProjectStartGrid = ({
	cells,
	height,
	onDecrement,
	onIncrement,
	onSet,
	scope,
	width,
}: EditorProjectStartGridProps) => {
	const { items } = useEditorItemSearchOptions();
	const [pickerCell, setPickerCell] = useState<{
		readonly x: number;
		readonly y: number;
	}>();
	const cellsByPosition = new Map(
		cells.map((cell) => [
			`${cell.x}:${cell.y}`,
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
		<>
			<div className="max-w-full overflow-auto rounded-xl border border-line bg-canvas/50 p-3">
				<div
					className="grid w-max gap-1.5"
					style={{
						gridTemplateColumns: `repeat(${Math.max(1, width)}, 4.5rem)`,
					}}
				>
					{positions.map(({ x, y }) => {
						const cell = cellsByPosition.get(`${x}:${y}`);
						const item = cell === undefined ? undefined : items[cell.itemId];
						const full =
							cell !== undefined &&
							item !== undefined &&
							cell.quantity >= item.maxStackSize;
						return (
							<button
								aria-label={
									cell === undefined
										? `Empty ${scope} slot ${x + 1}, ${y + 1}`
										: `${item?.title ?? cell.itemId}, quantity ${cell.quantity}`
								}
								className="relative grid size-[4.5rem] cursor-pointer place-items-center rounded-lg border border-line bg-surface/70 text-subtle transition-colors hover:border-line-strong hover:bg-surface-raised"
								key={`${x}:${y}`}
								onClick={() => {
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
				click to remove one.
			</p>
			{pickerCell === undefined ? null : (
				<EditorProjectStartItemPicker
					onClose={() => setPickerCell(undefined)}
					onSelect={(itemId) => onSet(pickerCell.x, pickerCell.y, itemId)}
					scope={scope}
				/>
			)}
		</>
	);
};
