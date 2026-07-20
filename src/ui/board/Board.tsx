import { TileGridFrame } from "~/ui/tile/TileGridFrame";
import { useBoardView } from "~/ui/board/useBoardView";

/** Renders the current board through the shared tile-grid surface. */
export const Board = () => {
	const view = useBoardView();

	return (
		<section
			className="size-full min-h-0 min-w-0"
			data-ui="Board"
		>
			<h1 className="sr-only">
				{view.title}, board space {view.currentSpace}
			</h1>
			<TileGridFrame
				surface={view.surface}
				width={view.width}
				height={view.height}
				cells={view.cells}
				frameUi="BoardFrame"
				gridUi="BoardGrid"
				cellUi="BoardCell"
			/>
		</section>
	);
};
