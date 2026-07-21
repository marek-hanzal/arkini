import type { CSSProperties } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import { TileGridCell } from "~/ui/tile/TileGridCell";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSurface } from "~/ui/tile/useTileSurface";

export namespace TileGridFrame {
	export interface Cell {
		readonly index: number;
		readonly x: number;
		readonly y: number;
		readonly occupant: TileIdentity | null;
	}

	export interface Props {
		readonly surface: TileSurface;
		readonly width: number;
		readonly height: number;
		readonly cells: ReadonlyArray<Cell>;
		readonly frameUi: string;
		readonly gridUi: string;
		readonly cellUi: string;
	}
}

/** Renders one shared styled tile grid over a concrete registered surface. */
export const TileGridFrame = ({
	surface,
	width,
	height,
	cells,
	frameUi,
	gridUi,
	cellUi,
}: TileGridFrame.Props) => {
	const surfaceRef = useTileSurface(surface);
	const gridStyle = {
		gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
		gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`,
	} satisfies CSSProperties;

	return (
		<div
			className="size-full rounded-[var(--ak-tile-grid-frame-radius)] border border-line bg-surface/75"
			data-ui={frameUi}
			data-tile-grid-frame="true"
		>
			<div
				ref={surfaceRef}
				className="grid size-full overflow-hidden rounded-[inherit]"
				data-ui={gridUi}
				data-tile-grid="true"
				data-tile-surface={surface.kind}
				data-tile-surface-id={surface.id}
				style={gridStyle}
			>
				{cells.map((cell) => (
					<TileGridCell
						key={cell.index}
						surface={surface}
						x={cell.x}
						y={cell.y}
						occupant={cell.occupant}
						dataUi={cellUi}
					/>
				))}
			</div>
		</div>
	);
};
