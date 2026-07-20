import type { CSSProperties } from "react";

import { BoardCell } from "~/ui/board/BoardCell";
import { useBoardView } from "~/ui/board/useBoardView";
import { useTileSurface } from "~/ui/tile/useTileSurface";

type BoardFrameStyle = CSSProperties & {
	readonly "--board-width-from-height": string;
	readonly "--board-height-from-width": string;
};

/** Renders the current board directly from the bridge's live runtime projection. */
export const Board = () => {
	const view = useBoardView();
	const surfaceRef = useTileSurface(view.surface);

	return (
		<section
			className="size-full min-h-0 min-w-0"
			data-ui="Board"
		>
			<h1 className="sr-only">
				{view.title}, board space {view.currentSpace}
			</h1>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="BoardViewport"
			>
				<div
					className="rounded-[clamp(0.75rem,2.5vmin,1.75rem)] border border-line bg-surface/75"
					data-ui="BoardFrame"
					style={view.frameStyle satisfies BoardFrameStyle}
				>
					<div
						ref={surfaceRef}
						className="grid size-full overflow-hidden rounded-[inherit]"
						data-ui="BoardGrid"
						data-tile-surface="board"
						data-tile-surface-id={view.surface.id}
						style={view.gridStyle}
					>
						{view.cells.map((cell) => (
							<BoardCell
								key={cell.index}
								surface={view.surface}
								x={cell.x}
								y={cell.y}
								occupant={cell.occupant}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
