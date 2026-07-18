import type { CSSProperties } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import { BoardTile } from "~/ui/board/BoardTile";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";

type BoardFrameStyle = CSSProperties & {
	readonly "--board-width-from-height": string;
	readonly "--board-height-from-width": string;
};

type BoardGridStyle = CSSProperties;

/** Renders the current board directly from the bridge's live runtime projection. */
export const Board = () => {
	const board = useBoard();
	// Runtime tiles occupy explicit grid cells, so backing cells must overlap them explicitly
	// rather than auto-flowing around them into implicit rows.
	const cells = Array.from(
		{
			length: board.width * board.height,
		},
		(_, index) => ({
			index,
			x: index % board.width,
			y: Math.floor(index / board.width),
		}),
	);
	const frameStyle = {
		aspectRatio: `${board.width} / ${board.height}`,
		"--board-width-from-height": `${(board.width / board.height) * 100}cqh`,
		"--board-height-from-width": `${(board.height / board.width) * 100}cqw`,
	} satisfies BoardFrameStyle;
	const gridStyle = {
		gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
		gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
	} satisfies BoardGridStyle;

	return (
		<section
			className="size-full min-h-0 min-w-0"
			data-ui="Board"
			style={{
				viewTransitionName: gameBoardViewTransitionName,
			}}
		>
			<h1 className="sr-only">
				{board.title}, board space {board.currentSpace}
			</h1>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="BoardViewport"
			>
				<div
					className="rounded-[clamp(0.75rem,2.5vmin,1.75rem)] border border-line bg-surface/75"
					data-ui="BoardFrame"
					style={frameStyle}
				>
					<div
						className="grid size-full overflow-hidden rounded-[inherit]"
						data-ui="BoardGrid"
						style={gridStyle}
					>
						{cells.map((cell) => (
							<div
								key={cell.index}
								className="min-h-0 min-w-0 rounded-[22%] border border-line/60 bg-surface-raised/45"
								style={{
									gridColumnStart: cell.x + 1,
									gridRowStart: cell.y + 1,
								}}
								aria-hidden="true"
								data-ui="BoardCell"
								data-board-x={cell.x}
								data-board-y={cell.y}
							/>
						))}
						{board.items.map((item) => (
							<BoardTile
								key={item.id}
								item={item}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
